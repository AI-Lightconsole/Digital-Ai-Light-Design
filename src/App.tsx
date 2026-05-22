import { useState, useRef, useEffect } from 'react'
import { GoogleGenAI, Type } from '@google/genai'
import { Upload, Zap, RotateCcw, Copy, Check, Send, Loader2, Sparkles, ExternalLink } from 'lucide-react'

const client = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY })

type LightType = 'sharpy' | 'macaura' | 'quantum' | 'titan' | 'strike4'
type StageSize = 'small' | 'medium' | 'large' | 'stargla'
type AITarget = 'midjourney' | 'chatgpt' | 'gemini'
type ShotType = 'front' | 'side'
type SideRatio = '16:9' | '2.7:1'

interface Marker { x: number; y: number }
interface AIPrompts {
  midjourney: string
  chatgpt: string
  gemini: string
}

const LIGHT_INFO: Record<LightType, { label: string; brand: string; type: string; img: string; color: string }> = {
  sharpy:  { label: 'Sharpy',      brand: 'Clay Paky', type: 'BEAM',    img: '/샤피-removebg-preview.png',                 color: '#22c55e' },
  macaura: { label: 'MAC Aura',    brand: 'Martin',    type: 'WASH',    img: '/AuraXB_2_x_large-removebg-preview (1).png', color: '#3b82f6' },
  quantum: { label: 'MAC Quantum', brand: 'Martin',    type: 'SPOT',    img: '/퀀텀-removebg-preview.png',                 color: '#f59e0b' },
  titan:   { label: 'Titan Tube',  brand: 'Astera',    type: 'TUBE',    img: '/아스테라-removebg-preview.png',             color: '#a855f7' },
  strike4: { label: 'Strike 4',    brand: 'Chauvet',   type: 'BLINDER', img: '/스트라이키-removebg-preview.png',           color: '#ef4444' },
}

const STAGE_SIZE_CONFIG: Record<StageSize, {
  label: string
  desc: string
  promptText: string
  scaleNote: string
  cols: number
  imgPx: number
  markerPx: number
}> = {
  small:   { label: '소형',   desc: '~10m',  promptText: 'small stage (under 10m wide)',  scaleNote: 'On this small stage, each fixture appears relatively large and clearly visible — roughly the size of a real moving-head light seen from the audience. Fixtures are prominent but still realistically proportioned to the compact stage.', cols: 2, imgPx: 80, markerPx: 28 },
  medium:  { label: '중형',   desc: '~20m',  promptText: 'medium stage (10-20m wide)',    scaleNote: 'On this medium stage, each fixture appears at a moderate, realistic size — clearly identifiable as a professional lighting unit, proportioned naturally to the stage width.', cols: 3, imgPx: 56, markerPx: 24 },
  large:   { label: '대형',   desc: '~40m',  promptText: 'large stage (20-40m wide)',     scaleNote: 'On this large stage, each fixture appears relatively small compared to the vast stage — like compact units mounted across a wide structure. Fixtures must NOT look oversized.', cols: 4, imgPx: 44, markerPx: 20 },
  stargla: { label: '스타글', desc: '40m+',  promptText: 'massive festival stage (40m+)', scaleNote: 'On this massive festival stage, each fixture appears as a small point-like unit within an enormous structure. Many small fixtures across huge trusses — never large or close-up.', cols: 5, imgPx: 36, markerPx: 16 },
}

const INSTALL_PRESETS = [
  { id: 'floor',       label: '바닥',        prompt: 'floor-mounted' },
  { id: 'object_top',  label: '오브젝트 위', prompt: 'mounted on top of stage objects' },
  { id: 'truss',       label: '트러스 설치', prompt: 'rigged on overhead truss' },
  { id: 'batten',      label: '바턴',        prompt: 'mounted on lighting battens' },
]

const BEAM_PRESETS = [
  { id: 'narrow', label: '좁게',   prompt: 'narrow tight focused beams' },
  { id: 'medium', label: '중간',   prompt: 'medium-spread beams' },
  { id: 'wide',   label: '넓게',   prompt: 'wide spread beams' },
  { id: 'prism',  label: '프리즘', prompt: 'prism-split multi-beam effect' },
]

const AI_INFO: Record<AITarget, { label: string; color: string; bg: string; border: string; url: string }> = {
  midjourney: { label: 'Midjourney',     color: '#f59e0b', bg: '#fef3c7', border: '#fcd34d', url: 'https://www.midjourney.com/imagine' },
  chatgpt:    { label: 'ChatGPT',        color: '#10a37f', bg: '#d1fae5', border: '#6ee7b7', url: 'https://chatgpt.com/' },
  gemini:     { label: 'Gemini', color: '#4285f4', bg: '#dbeafe', border: '#93c5fd', url: 'https://gemini.google.com/app' },
}

export default function App() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string | null>(null)
  const [stageSize, setStageSize] = useState<StageSize>('medium')
  const [shotType, setShotType] = useState<ShotType>('front')
  const [sideRatio, setSideRatio] = useState<SideRatio>('16:9')
  const [sideWithFixtures, setSideWithFixtures] = useState(true)
  const [lightType, setLightType] = useState<LightType>('sharpy')
  const [markers, setMarkers] = useState<Marker[]>([])
  const [selectedInstall, setSelectedInstall] = useState<string[]>([])
  const [selectedBeam, setSelectedBeam] = useState<string[]>([])
  const [customPrompt, setCustomPrompt] = useState('')
  const [prompts, setPrompts] = useState<AIPrompts | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<AITarget | null>(null)
  const [sent, setSent] = useState<AITarget | null>(null)
  const [extensionDetected, setExtensionDetected] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 익스텐션 감지
  useEffect(() => {
    const checkExtension = () => {
      window.dispatchEvent(new CustomEvent('extension:ping'))
    }
    const onPong = () => setExtensionDetected(true)
    window.addEventListener('extension:pong', onPong)
    checkExtension()
    const interval = setInterval(checkExtension, 2000)
    return () => {
      window.removeEventListener('extension:pong', onPong)
      clearInterval(interval)
    }
  }, [])

  // 익스텐션에서 이미지 수신 (A 기능 — 우클릭으로 들어오는 이미지)
  useEffect(() => {
    const handleLoadImage = async (e: Event) => {
      const { imageUrl } = (e as CustomEvent).detail as { imageUrl: string }
      try {
        if (imageUrl.startsWith('data:')) {
          setUploadedImage(imageUrl)
          setUploadedImageBase64(imageUrl.split(',')[1])
        } else {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = imageUrl })
          const canvas = document.createElement('canvas')
          canvas.width = img.width; canvas.height = img.height
          canvas.getContext('2d')!.drawImage(img, 0, 0)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
          setUploadedImage(dataUrl)
          setUploadedImageBase64(dataUrl.split(',')[1])
        }
        setMarkers([])
        setPrompts(null)
      } catch (err) {
        console.error('이미지 로드 실패:', err)
      }
    }
    window.addEventListener('extension:loadImage', handleLoadImage)
    return () => window.removeEventListener('extension:loadImage', handleLoadImage)
  }, [])

  const handleImageUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setUploadedImage(result)
      setUploadedImageBase64(result.split(',')[1])
      setMarkers([])
      setPrompts(null)
    }
    reader.readAsDataURL(file)
  }

  const handleMarkerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setMarkers(prev => [...prev, { x, y }])
  }

  const togglePreset = (id: string, selected: string[], setSelected: (v: string[]) => void) => {
    setSelected(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  const buildContext = () => {
    const light = LIGHT_INFO[lightType]
    const stageCfg = STAGE_SIZE_CONFIG[stageSize]
    const installDescs = selectedInstall.map(id => INSTALL_PRESETS.find(p => p.id === id)?.prompt || '').filter(Boolean)
    const beamDescs = selectedBeam.map(id => BEAM_PRESETS.find(p => p.id === id)?.prompt || '').filter(Boolean)
    const totalFixtures = markers.length * 2

    return {
      shot: shotType,
      sideRatio: sideRatio,
      sideWithFixtures: sideWithFixtures,
      stage: stageCfg.promptText,
      scale: stageCfg.scaleNote,
      fixture: `${light.brand} ${light.label} (${light.type} type)`,
      count: totalFixtures,
      symmetry: 'perfect left-right symmetric layout',
      install: installDescs.join(', ') || 'standard installation',
      beam: beamDescs.join(', ') || 'standard beam shape',
      custom: customPrompt || '',
    }
  }

  const generatePrompts = async () => {
    if (!uploadedImageBase64) { setError('무대 이미지를 먼저 업로드해주세요'); return }
    if (markers.length === 0) { setError('위치를 최소 1개 이상 지정해주세요'); return }

    setIsGenerating(true)
    setError(null)
    setPrompts(null)

    const ctx = buildContext()

    const isSide = ctx.shot === 'side'
    const sideRatioText = ctx.sideRatio === '2.7:1'
      ? 'wide panoramic side panel, approximately 2.7:1 aspect ratio (much wider than tall)'
      : 'standard 16:9 side panel'

    const systemInstruction = isSide
      ? `You are an expert AI image prompt engineer specializing in professional stage lighting design.

The user is creating a SIDE PANEL image — a left/right extension panel that will be placed beside a main front stage image on a wide media wall. Generate THREE prompts, each optimized for a different AI image generator.

**ABSOLUTE RULES — apply to all 3 prompts:**

1. This is a SIDE EXTENSION of a stage — it must visually continue the same stage space: same wall material, same floor, same ceiling/truss structure, same overall atmosphere as a typical broadcast stage. It will be mirrored and attached to both sides of a center image, so it must blend seamlessly.

2. ASPECT RATIO: ${sideRatioText}.

3. ${ctx.sideWithFixtures
  ? 'INCLUDE lighting fixtures — the same fixtures as the front stage must continue into this side panel, matching beam shape, color and installation, so the whole media wall reads as one continuous lighting design.'
  : 'NO lighting fixtures — this is a clean stage side panel WITHOUT any lighting equipment. Only the bare stage structure.'}

4. REALISTIC FIXTURE SCALE relative to the stage. Fixtures must never look oversized.

The same concept must be expressed in 3 formats:

**MIDJOURNEY (v7) format:**
- Short, dense, comma-separated visual keywords, 30-50 words
- Begin with: "stage side extension panel, seamless continuation of broadcast stage"
- End with: ${ctx.sideRatio === '2.7:1' ? '--ar 19:7 --v 7 --style raw --iw 3' : '--ar 16:9 --v 7 --style raw --iw 3'}
- Emphasize seamless blending, matching stage material, broadcast photography aesthetic

**CHATGPT (DALL-E 3) format:**
- Natural language descriptive paragraph, 60-100 words
- Describe a side extension panel of a broadcast stage in ${sideRatioText}
- Emphasize photorealism and seamless visual continuity with a main stage

**GEMINI (Nano Banana 이미지 생성) format — IMPORTANT:**
- 한국어 이미지 생성 명령문 (Korean image GENERATION command — NOT analysis)
- 반드시 첫 문장은 "방송 무대의 측면 확장 패널 이미지를 생성해줘. 메인 무대 옆에 붙일 좌우 확장용 이미지야." 로 시작
- ${sideRatioText} 를 한국어로 명시 (가로로 긴 와이드 비율)
- ${ctx.sideWithFixtures ? '정면 무대와 동일한 조명 장비가 측면까지 이어지도록 명시' : '조명 장비 없이 깨끗한 무대 측면 구조만 명시'}
- 마지막 줄에 반드시: "이미지를 새로 만들어서 보여줘. 분석 말고 결과 이미지를 생성해줘. 방송용 고화질."
- 총 80-150 단어, 절대 영어 금지, 무조건 명령형

Output JSON only.`
      : `You are an expert AI image prompt engineer specializing in professional stage lighting design.

Given a stage image and lighting specifications, generate THREE prompts for COMPOSITING the specified lighting fixtures onto the EXISTING stage — each optimized for a different AI image generator.

**TWO ABSOLUTE RULES — apply to all 3 prompts:**

1. PRESERVE THE ORIGINAL STAGE. The uploaded stage image is the fixed base. Keep its background, structure, perspective, and composition exactly as they are. Only ADD lighting fixtures onto it. Do NOT redraw, reinvent, or replace the stage. This is a compositing task, not a new image creation.

2. REALISTIC FIXTURE SCALE. The size of each lighting fixture must be realistically proportioned to the stage scale. Fixtures must never look oversized or undersized relative to the stage. Follow the provided scale guidance precisely.

The same lighting concept must be expressed in 3 different formats:

**MIDJOURNEY (v7) format:**
- Short, dense, comma-separated visual keywords
- 30-50 words
- Begin with a clear compositing instruction: "stage lighting fixtures composited onto the existing stage, original stage preserved"
- End with: --ar 16:9 --v 7 --style raw --iw 3
- Emphasize: the fixtures must match the stage, realistic fixture scale, professional broadcast photography aesthetic
- Example pattern: "lighting fixtures composited onto existing stage, original stage preserved, [fixture details], [realistic scale], [installation], [beam style], broadcast photography --ar 16:9 --v 7 --style raw --iw 3"

**CHATGPT (DALL-E 3) format:**
- Natural language descriptive paragraph
- 60-100 words
- Begin by stating the uploaded stage image must be kept and the fixtures added onto it
- Emphasize photorealism, realistic fixture scale relative to the stage, professional broadcast photography, specific lighting positions
- Describe the scene as if directing a photographer doing a composite

**GEMINI (Nano Banana 이미지 생성) format — IMPORTANT:**
- 한국어 이미지 생성 명령문 (Korean image GENERATION command — NOT analysis)
- 반드시 첫 문장은 "첨부된 무대 이미지를 편집해서 새 이미지를 생성해줘. 기존 무대 배경과 구조는 그대로 유지하고 조명 장비만 추가해줘." 로 시작
- 그 다음 줄에 구체적인 합성 지시:
  - 어떤 장비를 (브랜드/모델/타입)
  - 어디에 (설치 위치)
  - 어떤 빔 (형태, 색)
  - 몇 개를 (좌우 대칭, 수량)
  - 장비 크기는 무대 규모에 사실적으로 비례하도록 명시
- 마지막 줄에 반드시: "이미지를 새로 만들어서 보여줘. 분석 말고 결과 이미지를 생성해줘. 방송용 고화질, 기존 무대 배경은 유지, 장비 크기는 무대에 맞게."
- 총 80-150 단어
- 절대 영어 사용 금지
- 절대 묘사형/설명형 금지. 무조건 명령형 ("~해줘", "~만들어줘")

All 3 prompts must describe the SAME lighting setup but in each AI's preferred style.

Output JSON only.`

    const userPrompt = isSide
      ? `Generate AI image prompts for a STAGE SIDE PANEL:

- Aspect ratio: ${sideRatioText}
- Stage scale: ${ctx.stage}
- Fixture scale guidance: ${ctx.scale}
- Lighting fixtures: ${ctx.sideWithFixtures ? `INCLUDE — ${ctx.fixture}, ${ctx.beam}, ${ctx.install}, matching the front stage` : 'NONE — clean stage side panel without fixtures'}
${ctx.custom ? `- Additional direction: ${ctx.custom}` : ''}

This side panel will be mirrored and attached beside a main front stage image. It must blend seamlessly as one continuous stage.`
      : `Generate AI image prompts for compositing these lights onto the stage:

- Stage scale: ${ctx.stage}
- Fixture scale guidance: ${ctx.scale}
- Fixture: ${ctx.fixture}
- Total fixtures: ${ctx.count}
- Layout: ${ctx.symmetry}, ${markers.length} positions per side
- Installation: ${ctx.install}
- Beam shape: ${ctx.beam}
${ctx.custom ? `- Additional direction: ${ctx.custom}` : ''}

The image will show the EXISTING stage with these ${ctx.fixture} fixtures composited onto it. Keep the original stage; only add the fixtures at a realistic scale.`

    try {
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: uploadedImageBase64 } },
            { text: userPrompt },
          ],
        }],
        config: {
          systemInstruction,
          temperature: 0.3,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              midjourney: { type: Type.STRING },
              chatgpt: { type: Type.STRING },
              gemini: { type: Type.STRING },
            },
            required: ['midjourney', 'chatgpt', 'gemini'],
          },
        },
      })

      const parsed = JSON.parse(response.text || '{}') as AIPrompts
      setPrompts(parsed)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '프롬프트 생성 실패')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyPrompt = async (ai: AITarget) => {
    if (!prompts) return
    await navigator.clipboard.writeText(prompts[ai])
    setCopied(ai)
    setTimeout(() => setCopied(null), 2000)
  }

  const sendToAI = (ai: AITarget) => {
    if (!prompts) return
    const prompt = prompts[ai]
    const imageDataUrl = uploadedImage // data URL 형태 (참조 이미지)
    if (extensionDetected) {
      window.dispatchEvent(new CustomEvent('extension:openAIPrompt', {
        detail: { ai, prompt, url: AI_INFO[ai].url, imageDataUrl },
      }))
      setSent(ai)
      setTimeout(() => setSent(null), 2000)
    } else {
      navigator.clipboard.writeText(prompt)
      window.open(AI_INFO[ai].url, '_blank')
    }
  }

  const sendAll = () => {
    if (!prompts) return
    (['midjourney', 'chatgpt', 'gemini'] as AITarget[]).forEach((ai, i) => {
      setTimeout(() => sendToAI(ai), i * 300)
    })
  }

  const reset = () => {
    setUploadedImage(null); setUploadedImageBase64(null)
    setMarkers([]); setPrompts(null)
    setSelectedInstall([]); setSelectedBeam([])
    setCustomPrompt(''); setError(null)
  }

  const stageCfg = STAGE_SIZE_CONFIG[stageSize]

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-green-500 rounded-md flex items-center justify-center">
            <Zap size={15} className="text-white" />
          </div>
          <span className="font-semibold text-gray-800">디지털 조명 AI 디자인</span>
          <span className="text-xs text-gray-400">Midjourney · ChatGPT · Gemini 동시 전송</span>
          {extensionDetected && (
            <span className="flex items-center gap-1 text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> 익스텐션 연결됨
            </span>
          )}
        </div>
        <button onClick={reset} className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-50">
          <RotateCcw size={12} /> 초기화
        </button>
      </div>

      <div className="flex flex-col xl:flex-row xl:h-[calc(100vh-52px)]">
        {/* ── 왼쪽 컨트롤 패널 ── */}
        <div className="w-full xl:w-[420px] xl:flex-shrink-0 bg-white border-b xl:border-b-0 xl:border-r border-gray-200 xl:overflow-y-auto p-4 flex flex-col gap-5">

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-700">작업 종류</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {(['front', 'side'] as ShotType[]).map(s => (
                <button key={s} onClick={() => setShotType(s)}
                  className={`py-2 rounded-lg border-2 text-xs font-bold transition-all ${shotType === s ? 'bg-green-50 border-green-500 text-green-600' : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'}`}>
                  {s === 'front' ? '정면' : '측면'}
                </button>
              ))}
            </div>
            {shotType === 'side' && (
              <div className="flex flex-col gap-2 mt-1">
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1.5">측면 비율</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['16:9', '2.7:1'] as SideRatio[]).map(r => (
                      <button key={r} onClick={() => setSideRatio(r)}
                        className={`py-1.5 rounded-lg border-2 text-xs font-bold transition-all ${sideRatio === r ? 'bg-green-50 border-green-500 text-green-600' : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1.5">장비 합성</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button onClick={() => setSideWithFixtures(true)}
                      className={`py-1.5 rounded-lg border-2 text-xs font-bold transition-all ${sideWithFixtures ? 'bg-green-50 border-green-500 text-green-600' : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'}`}>
                      켜기
                    </button>
                    <button onClick={() => setSideWithFixtures(false)}
                      className={`py-1.5 rounded-lg border-2 text-xs font-bold transition-all ${!sideWithFixtures ? 'bg-green-50 border-green-500 text-green-600' : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'}`}>
                      끄기
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-[10px] font-bold text-white">1</div>
              <span className="text-xs font-semibold text-gray-700">무대 크기</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.keys(STAGE_SIZE_CONFIG) as StageSize[]).map(s => (
                <button key={s} onClick={() => setStageSize(s)}
                  className={`flex flex-col items-center py-2.5 px-1 rounded-lg border-2 transition-all ${stageSize === s ? 'bg-green-50 border-green-500' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
                  <span className={`text-xs font-bold leading-tight ${stageSize === s ? 'text-green-600' : 'text-gray-700'}`}>
                    {STAGE_SIZE_CONFIG[s].label}
                  </span>
                  <span className="text-[9px] text-gray-400 mt-0.5">{STAGE_SIZE_CONFIG[s].desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-[10px] font-bold text-white">2</div>
              <span className="text-xs font-semibold text-gray-700">무대 이미지 업로드</span>
            </div>
            <div
              className="relative w-full border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors overflow-hidden"
              style={{ aspectRatio: '16/9' }}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) handleImageUpload(f) }}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadedImage ? (
                <img src={uploadedImage} alt="uploaded" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <Upload size={24} className="mb-2" />
                  <p className="text-xs">클릭 또는 드래그로 업로드</p>
                  <p className="text-[10px] text-gray-300 mt-1">또는 웹 이미지 우클릭 → 보내기</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-[10px] font-bold text-white">3</div>
              <span className="text-xs font-semibold text-gray-700">장비 선택</span>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${stageCfg.cols}, 1fr)` }}>
              {(Object.keys(LIGHT_INFO) as LightType[]).map(l => (
                <button key={l} onClick={() => setLightType(l)}
                  className={`flex flex-col items-center rounded-lg border-2 transition-all ${lightType === l ? 'bg-green-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
                  style={{
                    padding: stageCfg.imgPx >= 56 ? '8px' : stageCfg.imgPx >= 44 ? '6px' : '4px',
                    borderColor: lightType === l ? LIGHT_INFO[l].color : undefined,
                  }}>
                  <div className="w-full flex items-center justify-center overflow-hidden" style={{ height: `${stageCfg.imgPx}px` }}>
                    <img src={LIGHT_INFO[l].img} alt={LIGHT_INFO[l].label} className="max-w-full max-h-full object-contain" />
                  </div>
                  <span className="font-semibold text-gray-600 mt-1 leading-tight" style={{ fontSize: stageCfg.imgPx >= 56 ? '10px' : '9px' }}>{LIGHT_INFO[l].type}</span>
                  <span className="text-gray-400 leading-tight" style={{ fontSize: stageCfg.imgPx >= 56 ? '9px' : '8px' }}>{LIGHT_INFO[l].label}</span>
                </button>
              ))}
            </div>
          </div>

          {uploadedImage && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-[10px] font-bold text-white">4</div>
                <span className="text-xs font-semibold text-gray-700">위치 지정</span>
                <span className="text-xs text-gray-400">(한쪽만 클릭)</span>
              </div>
              <div className="relative rounded-lg overflow-hidden cursor-crosshair border-2"
                style={{ borderColor: LIGHT_INFO[lightType].color }}
                onClick={handleMarkerClick}>
                <img src={uploadedImage} alt="stage" className="w-full h-44 object-cover" />
                {markers.map((m, i) => (
                  <div key={i}>
                    <div style={{ position: 'absolute', left: `${m.x}%`, top: `${m.y}%`, transform: 'translate(-50%,-50%)',
                        background: LIGHT_INFO[lightType].color, width: `${stageCfg.markerPx}px`, height: `${stageCfg.markerPx}px` }}
                      className="rounded-full border-2 border-white flex items-center justify-center pointer-events-none shadow-md">
                      <span className="text-white font-bold" style={{ fontSize: `${Math.max(6, stageCfg.markerPx * 0.35)}px` }}>{i + 1}</span>
                    </div>
                    <div style={{ position: 'absolute', left: `${100 - m.x}%`, top: `${m.y}%`, transform: 'translate(-50%,-50%)',
                        background: LIGHT_INFO[lightType].color, opacity: 0.5, width: `${stageCfg.markerPx}px`, height: `${stageCfg.markerPx}px` }}
                      className="rounded-full border-2 border-white flex items-center justify-center pointer-events-none shadow-md">
                      <span className="text-white font-bold" style={{ fontSize: `${Math.max(6, stageCfg.markerPx * 0.35)}px` }}>{i + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-gray-400">총 {markers.length * 2}개 (좌우 대칭)</span>
                {markers.length > 0 && <button onClick={() => setMarkers([])} className="text-xs text-red-400 hover:text-red-600">초기화</button>}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-[10px] font-bold text-white">5</div>
              <span className="text-xs font-semibold text-gray-700">연출 프리셋</span>
              <span className="text-xs text-gray-400">(복수 선택)</span>
            </div>
            <div className="mb-3">
              <div className="text-xs font-medium text-gray-500 mb-1.5">설치 위치</div>
              <div className="flex flex-wrap gap-1.5">
                {INSTALL_PRESETS.map(p => (
                  <button key={p.id} onClick={() => togglePreset(p.id, selectedInstall, setSelectedInstall)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${selectedInstall.includes(p.id) ? 'bg-green-500 border-green-500 text-white font-medium' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-green-300'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">빔 모양</div>
              <div className="flex flex-wrap gap-1.5">
                {BEAM_PRESETS.map(p => (
                  <button key={p.id} onClick={() => togglePreset(p.id, selectedBeam, setSelectedBeam)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${selectedBeam.includes(p.id) ? 'bg-blue-500 border-blue-500 text-white font-medium' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-500 mb-1.5">추가 직접 입력 (선택)</div>
            <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
              placeholder="예: 빔이 얼음에 굴절되게, 바닥 반사 강조..."
              className="w-full text-xs p-2.5 border border-gray-200 rounded-md bg-gray-50 resize-none h-14 focus:outline-none focus:border-green-400" />
          </div>

          <button onClick={generatePrompts} disabled={isGenerating || !uploadedImage || markers.length === 0}
            className="w-full py-3 bg-green-500 text-white font-semibold rounded-md hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors">
            {isGenerating
              ? <><Loader2 size={15} className="animate-spin" /> 3개 AI 프롬프트 생성 중...</>
              : <><Sparkles size={15} /> 멀티 AI 프롬프트 생성</>
            }
          </button>

          {error && <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-md">{error}</div>}
        </div>

        {/* ── 오른쪽 결과 패널 ── */}
        <div className="flex-1 p-5 xl:overflow-y-auto bg-gray-50">
          {!prompts && !isGenerating && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <div className="w-16 h-16 border border-gray-300 rounded-xl flex items-center justify-center mb-3">
                <Sparkles size={28} className="text-gray-300" />
              </div>
              <p className="text-sm font-medium">왼쪽에서 설정 후 프롬프트 생성</p>
              <p className="text-xs mt-1 text-gray-400">Midjourney · ChatGPT · Gemini용 프롬프트가 동시에 생성됩니다</p>
            </div>
          )}

          {isGenerating && (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <Loader2 size={40} className="animate-spin text-green-500 mb-4" />
              <p className="text-sm font-medium">3개 AI 프롬프트 생성 중...</p>
            </div>
          )}

          {prompts && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-800">생성된 프롬프트</h2>
                <button onClick={sendAll}
                  className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors">
                  <Send size={12} /> 3개 AI 모두 전송
                </button>
              </div>

              {(Object.keys(AI_INFO) as AITarget[]).map(ai => {
                const info = AI_INFO[ai]
                return (
                  <div key={ai} className="bg-white rounded-xl border-2 p-4" style={{ borderColor: info.border }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: info.bg, color: info.color }}>{info.label}</span>
                        <span className="text-[10px] text-gray-400">{info.url.replace('https://', '')}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => copyPrompt(ai)}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600 font-medium">
                          {copied === ai ? <><Check size={11} /> 복사됨</> : <><Copy size={11} /> 복사</>}
                        </button>
                        <button onClick={() => sendToAI(ai)}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 text-white font-semibold rounded-md transition-colors"
                          style={{ background: info.color }}>
                          {sent === ai ? <><Check size={11} /> 전송됨</> : <><ExternalLink size={11} /> {extensionDetected ? '바로 보내기' : '열기'}</>}
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-700 leading-relaxed bg-gray-50 rounded-md p-3 border border-gray-100 whitespace-pre-wrap break-words">
                      {prompts[ai]}
                    </div>
                    {ai === 'gemini' && (
                      <div className="mt-2 text-[10px] text-blue-600 bg-blue-50 px-2 py-1.5 rounded">
                        💡 Gemini가 분석만 하면 "이미지를 생성해줘" 한마디 더 입력하세요
                      </div>
                    )}
                  </div>
                )
              })}

              {!extensionDetected && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-md">
                  💡 익스텐션이 감지되지 않았습니다. 설치하시면 "바로 보내기" 버튼으로 각 AI 사이트에 자동 붙여넣기가 됩니다.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
