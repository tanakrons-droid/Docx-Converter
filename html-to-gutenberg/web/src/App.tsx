import { useState, useCallback } from 'react';
import { 
  FileCode2, 
  Wand2, 
  Copy, 
  Check, 
  AlertTriangle, 
  Info,
  Settings,
  ChevronDown,
  ChevronUp,
  Trash2,
  Download,
  Upload
} from 'lucide-react';
import { convert, type PolicyConfig, type ConversionReport, SUPPORTED_WEBSITES, type SupportedWebsite } from './utils/converter';

// Sample HTML for demo
const sampleHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    .c1 { font-weight: bold; }
    .c2 { color: #1a73e8; }
    .c3 { font-style: italic; }
  </style>
</head>
<body>
  <p>ส่วนหัวบทความที่จะถูกลบ</p>
  
  <h1>บทความตัวอย่าง - ฉีดฟิลเลอร์</h1>
  
  <p><strong>สารบัญ</strong></p>
  <ul>
    <li>หัวข้อที่ 1</li>
    <li>หัวข้อที่ 2</li>
  </ul>
  
  <h2>หัวข้อที่ 1: แนะนำ</h2>
  <p>นี่คือ<span class="c1">ข้อความตัวหนา</span>และ<span class="c2">ข้อความสีน้ำเงิน</span></p>
  
  <p><img src="https://example.com/image1.jpg" alt="Alt: รูปภาพตัวอย่าง 1"/></p>
  <p><em>คำอธิบายรูปภาพ (caption)</em></p>
  
  <h2>หัวข้อที่ 2: รายการ</h2>
  <ul>
    <li>รายการที่ 1</li>
    <li>รายการที่ 2</li>
    <li>รายการที่ 3</li>
  </ul>
  
  <p><img src="https://example.com/image2.jpg" alt="รูป 2"/><img src="https://example.com/image3.jpg" alt="รูป 3"/></p>
  
  <h2>วิดีโอแนะนำ</h2>
  <p>https://www.youtube.com/watch?v=dQw4w9WgXcQ วิดีโอสาธิตการใช้งาน</p>
  
  <h2>โปรโมชั่นพิเศษ</h2>
  <p>สำหรับลูกค้าใหม่ รับส่วนลด 20% ทันที!</p>
  
  <blockquote>
    "เครื่องมือนี้ช่วยประหยัดเวลาได้มาก"
  </blockquote>
  
  <p><strong>อ่านบทความเพิ่มเติม</strong></p>
  <ul>
    <li><a href="#">บทความที่เกี่ยวข้อง 1</a></li>
  </ul>
  
  <p><strong>อ้างอิง</strong></p>
  <ul>
    <li>แหล่งอ้างอิง 1</li>
    <li>แหล่งอ้างอิง 2</li>
  </ul>
  
  <p><span class="c3">ขอบคุณที่อ่านบทความนี้</span></p>
  
  <p>NOTE SEO Writer: โน้ตสำหรับนักเขียน - ส่วนนี้จะถูกลบ</p>
  <p>ข้อความหลัง NOTE SEO ที่จะถูกลบทิ้ง</p>
</body>
</html>`;

function App() {
  const [inputHtml, setInputHtml] = useState(sampleHtml);
  const [outputHtml, setOutputHtml] = useState('');
  const [report, setReport] = useState<ConversionReport | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [selectedWebsite, setSelectedWebsite] = useState<SupportedWebsite | ''>('');
  
  // Policy settings
  const [policies, setPolicies] = useState<PolicyConfig>({
    forbiddenTags: {
      enabled: true,
      tags: ['script', 'iframe', 'object', 'embed', 'form']
    },
    removeBeforeH1: {
      enabled: true
    },
    removeAfterNoteSEO: {
      enabled: true
    },
    requireH2: {
      enabled: true,
      minCount: 1,
      autoGenerate: false
    },
    addDisclaimer: {
      enabled: true,
      keywords: ['โปรโมชั่น', 'ส่วนลด', 'promotion', 'discount']
    }
  });

  const handleConvert = useCallback(() => {
    if (!inputHtml.trim()) return;
    
    // Require website selection
    if (!selectedWebsite) {
      setReport({
        inputLength: inputHtml.length,
        outputLength: 0,
        blocksCreated: 0,
        policiesTriggered: [],
        warnings: ['กรุณาเลือกเว็บไซต์ก่อนทำการแปลง'],
        errors: [],
        executionTimeMs: 0
      });
      return;
    }
    
    setIsConverting(true);
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        const result = convert(inputHtml, {
          inlineStyles: true,
          policies
        });
        
        setOutputHtml(result.html);
        setReport(result.report);
      } catch (error) {
        console.error('Conversion error:', error);
        setReport({
          inputLength: inputHtml.length,
          outputLength: 0,
          blocksCreated: 0,
          policiesTriggered: [],
          warnings: [],
          errors: [error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการแปลง'],
          executionTimeMs: 0
        });
      } finally {
        setIsConverting(false);
      }
    }, 100);
  }, [inputHtml, policies, selectedWebsite]);

  const handleCopy = useCallback(async () => {
    if (!outputHtml) return;
    
    try {
      await navigator.clipboard.writeText(outputHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }, [outputHtml]);

  const handleClear = useCallback(() => {
    setInputHtml('');
    setOutputHtml('');
    setReport(null);
  }, []);

  const handleLoadSample = useCallback(() => {
    setInputHtml(sampleHtml);
    setOutputHtml('');
    setReport(null);
  }, []);

  const handleDownload = useCallback(() => {
    if (!outputHtml) return;
    
    const blob = new Blob([outputHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gutenberg-output.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [outputHtml]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputHtml(content);
      setOutputHtml('');
      setReport(null);
    };
    reader.readAsText(file);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <FileCode2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">HTML to Gutenberg</h1>
                <p className="text-xs text-gray-500">แปลง HTML เป็น WordPress Blocks</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Website Selection */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 hidden sm:inline">เว็บไซต์:</label>
                <select
                  value={selectedWebsite}
                  onChange={(e) => setSelectedWebsite(e.target.value as SupportedWebsite | '')}
                  className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    !selectedWebsite ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                >
                  <option value="">-- เลือกเว็บไซต์ --</option>
                  {SUPPORTED_WEBSITES.map((website) => (
                    <option key={website} value={website}>
                      {website}
                    </option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`btn ${showSettings ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">ตั้งค่า</span>
                {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white border-b border-gray-200 animate-fade-in">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Policy Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Remove Before H1 */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policies.removeBeforeH1.enabled}
                    onChange={(e) => setPolicies(p => ({
                      ...p,
                      removeBeforeH1: { ...p.removeBeforeH1, enabled: e.target.checked }
                    }))}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm font-medium">ลบเนื้อหาก่อน H1</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  ลบส่วนหัวบทความอัตโนมัติ
                </p>
              </div>

              {/* Remove After NOTE SEO */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policies.removeAfterNoteSEO.enabled}
                    onChange={(e) => setPolicies(p => ({
                      ...p,
                      removeAfterNoteSEO: { ...p.removeAfterNoteSEO, enabled: e.target.checked }
                    }))}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm font-medium">ลบหลัง NOTE SEO</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  ลบโน้ตสำหรับนักเขียน
                </p>
              </div>

              {/* Forbidden Tags */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policies.forbiddenTags.enabled}
                    onChange={(e) => setPolicies(p => ({
                      ...p,
                      forbiddenTags: { ...p.forbiddenTags, enabled: e.target.checked }
                    }))}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm font-medium">ลบแท็กอันตราย</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  script, iframe, object, embed, form
                </p>
              </div>

              {/* Require H2 */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policies.requireH2.enabled}
                    onChange={(e) => setPolicies(p => ({
                      ...p,
                      requireH2: { ...p.requireH2, enabled: e.target.checked }
                    }))}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm font-medium">ตรวจสอบหัวข้อ H2</span>
                </label>
                <div className="mt-2 ml-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policies.requireH2.autoGenerate}
                      onChange={(e) => setPolicies(p => ({
                        ...p,
                        requireH2: { ...p.requireH2, autoGenerate: e.target.checked }
                      }))}
                      className="w-3 h-3 text-primary-600 rounded"
                      disabled={!policies.requireH2.enabled}
                    />
                    <span className="text-xs text-gray-600">สร้างอัตโนมัติ</span>
                  </label>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policies.addDisclaimer.enabled}
                    onChange={(e) => setPolicies(p => ({
                      ...p,
                      addDisclaimer: { ...p.addDisclaimer, enabled: e.target.checked }
                    }))}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm font-medium">เพิ่ม Disclaimer</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  เมื่อพบคำว่า โปรโมชั่น, ส่วนลด
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Website Selection Warning */}
        {!selectedWebsite && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <span className="text-sm font-medium">กรุณาเลือกเว็บไซต์ก่อนทำการแปลง</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={handleConvert}
            disabled={!inputHtml.trim() || isConverting || !selectedWebsite}
            className={`btn flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              selectedWebsite ? 'btn-primary' : 'bg-gray-400 text-white'
            }`}
          >
            <Wand2 className={`w-4 h-4 ${isConverting ? 'animate-spin' : ''}`} />
            {isConverting ? 'กำลังแปลง...' : 'แปลงเป็น Gutenberg'}
          </button>
          
          <button onClick={handleLoadSample} className="btn btn-secondary">
            โหลดตัวอย่าง
          </button>
          
          <label className="btn btn-secondary flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            อัปโหลดไฟล์
            <input
              type="file"
              accept=".html,.htm"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          
          <button onClick={handleClear} className="btn btn-secondary flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            ล้าง
          </button>

          {outputHtml && (
            <>
              <button
                onClick={handleCopy}
                className="btn btn-success flex items-center gap-2 ml-auto"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'คัดลอกแล้ว!' : 'คัดลอก'}
              </button>
              
              <button
                onClick={handleDownload}
                className="btn btn-secondary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                ดาวน์โหลด
              </button>
            </>
          )}
        </div>

        {/* Editor Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Input */}
          <div className="card">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">HTML Input</h2>
              <span className="text-xs text-gray-500">
                {inputHtml.length.toLocaleString()} ตัวอักษร
              </span>
            </div>
            <textarea
              value={inputHtml}
              onChange={(e) => setInputHtml(e.target.value)}
              placeholder="วาง HTML ที่นี่..."
              className="w-full h-[500px] p-4 font-mono text-sm resize-none focus:outline-none code-editor"
              spellCheck={false}
            />
          </div>

          {/* Output */}
          <div className="card">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">Gutenberg Output</h2>
              {report && (
                <span className="text-xs text-gray-500">
                  {report.blocksCreated} blocks • {report.executionTimeMs}ms
                </span>
              )}
            </div>
            <textarea
              value={outputHtml}
              readOnly
              placeholder="ผลลัพธ์จะแสดงที่นี่..."
              className="w-full h-[500px] p-4 font-mono text-sm resize-none focus:outline-none bg-gray-50 code-editor"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Report */}
        {report && (
          <div className="mt-4 card animate-fade-in">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-700">รายงานการแปลง</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{report.blocksCreated}</div>
                  <div className="text-xs text-blue-600">Blocks สร้าง</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{report.executionTimeMs}ms</div>
                  <div className="text-xs text-green-600">เวลาประมวลผล</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{report.policiesTriggered.length}</div>
                  <div className="text-xs text-purple-600">Policies ทำงาน</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{report.warnings.length}</div>
                  <div className="text-xs text-orange-600">คำเตือน</div>
                </div>
              </div>

              {/* Policies Triggered */}
              {report.policiesTriggered.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-500" />
                    Policies ที่ทำงาน
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {report.policiesTriggered.map((policy, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {policy}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {report.warnings.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    คำเตือน
                  </h4>
                  <ul className="space-y-1">
                    {report.warnings.map((warning, i) => (
                      <li key={i} className="text-sm text-yellow-700 bg-yellow-50 px-3 py-2 rounded">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Errors */}
              {report.errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    ข้อผิดพลาด
                  </h4>
                  <ul className="space-y-1">
                    {report.errors.map((error, i) => (
                      <li key={i} className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded">
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            HTML to Gutenberg Converter • แปลง HTML จาก Google Docs/Word เป็น WordPress Gutenberg Blocks
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
