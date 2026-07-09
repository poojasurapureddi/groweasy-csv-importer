'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import {
  Upload, FileText, CheckCircle, AlertTriangle, Play, RefreshCw,
  Download, ArrowRight, ArrowLeft, Sun, Moon, Database, Settings,
  Users, Check, X, ShieldAlert, Cpu
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

// Define CRM Lead interface
interface CRMLead {
  created_at: string | null;
  name: string | null;
  email: string | null;
  country_code: string | null;
  mobile_without_country_code: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lead_owner: string | null;
  crm_status: 'GOOD_LEAD_FOLLOW_UP' | 'DID_NOT_CONNECT' | 'BAD_LEAD' | 'SALE_DONE';
  crm_note: string | null;
  data_source: string | null;
  possession_time: string | null;
  description: string | null;
  is_skipped?: boolean;
}

// Pre-defined sample templates to make testing easy
const SAMPLES = {
  facebook: {
    name: 'facebook_leads_export.csv',
    csv: `created_time,full_name,email_address,phone_number,company_name,city_location,status_code,notes
2026-05-10 10:14:02,Aarav Sharma,aarav.sharma@gmail.com,+91 9988776655,Apex Tech,Mumbai,GOOD_LEAD,Wants demo on Friday at 4 PM
2026-05-10 11:20:15,Meera Nair,meera.nair@yahoo.com,9876543210,,Bangalore,DID_NOT_CONNECT,Called twice, no response. Extra phone: +919876543219
2026-05-10 12:45:00,Unknown Lead,,,Startup LLC,Delhi,BAD_LEAD,Spam signup
2026-05-11 09:30:10,Vikram Singh,vikram.singh@outlook.com,8888877777,Green Energy,Pune,SALE_DONE,Payment received. Primary email: vikram@green.co
2026-05-11 14:15:33,Anjali Gupta,anjali.g@gmail.com;anjali.work@gmail.com,+918888899999,Gupta & Sons,Kolkata,GOOD_LEAD,Interested in Sarjapur Plots project`
  },
  realestate: {
    name: 'real_estate_crm_export.csv',
    csv: `date_added,client_name,mail,contact_no,firm,location_city,source,possession_timeline,remarks
12/05/2026 18:22,Rajesh Patel,rajesh@patelbuilders.com,+91 9123456789,Patel Builders,Ahmedabad,leads_on_demand,Ready to Move,Looking for 3BHK premium
13/05/2026 09:15,Sarah Connor,sconnor@cyberdyne.io,1-555-0199,Connor Sec,Los Angeles,,2 Years,Interested in meridian_tower. Owner: john@groweasy.ai
13/05/2026 12:00,Amit Verma,,+919900112233,,Noida,varah_swamy,,No email provided. Wants immediate call back
13/05/2026 14:02,,info@domain.com,,,Hyderabad,eden_park,1 Year,No phone number`
  },
  messy: {
    name: 'messy_sales_sheet.csv',
    csv: `Name,Contact,Mail,Details,Owner,State,Status
"Roy, David",+91 9500011122;9500011123,david.roy@company.com;david.personal@gmail.com,"Looking for office space, budget 50k",admin@groweasy.ai,Maharashtra,SALE_DONE
"Priya Sen",,,Just browsing,sales@groweasy.ai,Karnataka,BAD_LEAD
"Karan Malhotra",+917766554433,karan@malhotra.in,"Requires project eden_park details",admin@groweasy.ai,Delhi,GOOD_LEAD_FOLLOW_UP`
  }
};

export default function Home() {
  // Navigation & workflow states
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileName, setFileName] = useState<string>('');
  
  // Data states
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [crmRecords, setCrmRecords] = useState<CRMLead[]>([]);
  const [skippedRecords, setSkippedRecords] = useState<CRMLead[]>([]);

  // Config & Status states
  const [backendUrl, setBackendUrl] = useState<string>(
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
);
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  const [apiProvider, setApiProvider] = useState<string>('gemini');
  
  // Table Page States (for raw preview)
  const [previewPage, setPreviewPage] = useState<number>(1);
  const previewRowsPerPage = 8;

  // Processing & progress states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState({
    currentBatch: 0,
    totalBatches: 0,
    percentage: 0
  });
  const [logs, setLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Results display tab
  const [resultsTab, setResultsTab] = useState<'success' | 'skipped'>('success');
  const [resultsPage, setResultsPage] = useState<number>(1);
  const resultsRowsPerPage = 8;

  // Check backend health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/health`);
        if (res.ok) {
          const data = await res.json();
          setBackendHealthy(true);
          setApiProvider(data.provider || 'gemini');
        } else {
          setBackendHealthy(false);
        }
      } catch (err) {
        setBackendHealthy(false);
      }
    };
    checkHealth();
  }, [backendUrl]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // CSV Drag and Drop parser
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.meta.fields) {
          setHeaders(results.meta.fields);
          setRecords(results.data);
          setPreviewRows(results.data);
          setPreviewPage(1);
          setStep(2);
        } else {
          alert('Could not parse headers from CSV file.');
        }
      },
      error: (error) => {
        alert(`Error parsing CSV: ${error.message}`);
      }
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    multiple: false
  });

  // Load sample template directly
  const loadSample = (type: 'facebook' | 'realestate' | 'messy') => {
    const sample = SAMPLES[type];
    setFileName(sample.name);
    
    Papa.parse(sample.csv, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.meta.fields) {
          setHeaders(results.meta.fields);
          setRecords(results.data);
          setPreviewRows(results.data);
          setPreviewPage(1);
          setStep(2);
        }
      }
    });
  };

  // Run the batch import mapping via backend chunked stream
  const startImport = async () => {
    setStep(3);
    setIsProcessing(true);
    setCrmRecords([]);
    setSkippedRecords([]);
    setLogs(['Initiating AI Extraction...', `Total records to process: ${records.length}`]);

    const batchSize = 15;
    const totalBatches = Math.ceil(records.length / batchSize);
    setProgress({ currentBatch: 0, totalBatches, percentage: 0 });

    try {
      const response = await fetch(`${backendUrl}/api/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headers,
          records,
          batchSize
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned error: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Readable stream not supported by browser or backend response.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      const successAcc: CRMLead[] = [];
      const skippedAcc: CRMLead[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Save the last partial line back to buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const chunk = JSON.parse(line);

            if (chunk.status === 'progress') {
              const currentBatch = chunk.batchIndex;
              const pct = Math.round((currentBatch / totalBatches) * 100);
              
              setProgress({
                currentBatch,
                totalBatches,
                percentage: pct
              });

              // Process mapped records
              const batchRecords = chunk.records as CRMLead[];
              const mapped = batchRecords.filter(r => !r.is_skipped);
              const skipped = batchRecords.filter(r => r.is_skipped);

              successAcc.push(...mapped);
              skippedAcc.push(...skipped);

              setLogs(prev => [
                ...prev,
                `Batch ${currentBatch}/${totalBatches} completed: Mapped ${mapped.length} leads, Skipped ${skipped.length} invalid rows.`
              ]);
            } else if (chunk.status === 'complete') {
              setLogs(prev => [
                ...prev,
                `Processing fully complete! Total Mapped: ${chunk.totalImported}, Total Skipped: ${chunk.totalSkipped}`
              ]);
            } else if (chunk.status === 'error') {
              throw new Error(chunk.error);
            }
          } catch (err: any) {
            console.error('Failed to parse stream line:', line, err);
            setLogs(prev => [...prev, `[Warning] Failed to parse line: ${err.message}`]);
          }
        }
      }

      setCrmRecords(successAcc);
      setSkippedRecords(skippedAcc);
      setResultsTab(successAcc.length > 0 ? 'success' : 'skipped');
      setResultsPage(1);
      setIsProcessing(false);
      setStep(4);
    } catch (err: any) {
      console.error('Stream processing failed:', err);
      setLogs(prev => [...prev, `[Fatal Error] Mapping failed: ${err.message}`]);
      setIsProcessing(false);
    }
  };

  // Client side CSV exporter
  const exportCRMCSV = () => {
    const targetFields = [
      'created_at', 'name', 'email', 'country_code', 'mobile_without_country_code',
      'company', 'city', 'state', 'country', 'lead_owner', 'crm_status',
      'crm_note', 'data_source', 'possession_time', 'description'
    ];

    const csvRows = [targetFields.join(',')];

    const dataToExport = resultsTab === 'success' ? crmRecords : skippedRecords;

    dataToExport.forEach(row => {
      const values = targetFields.map(field => {
        let val = row[field as keyof CRMLead];
        if (val === null || val === undefined) {
          val = '';
        }
        // Escape double quotes and remove newlines for valid single row
        val = val.toString().replace(/"/g, '""').replace(/\r?\n|\r/g, ' ');
        return `"${val}"`;
      });
      csvRows.push(values.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `groweasy_crm_${resultsTab}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination helpers
  const totalPreviewPages = Math.ceil(previewRows.length / previewRowsPerPage);
  const paginatedPreviewRows = previewRows.slice(
    (previewPage - 1) * previewRowsPerPage,
    previewPage * previewRowsPerPage
  );

  const activeResultsList = resultsTab === 'success' ? crmRecords : skippedRecords;
  const totalResultsPages = Math.ceil(activeResultsList.length / resultsRowsPerPage);
  const paginatedResultsRows = activeResultsList.slice(
    (resultsPage - 1) * resultsRowsPerPage,
    resultsPage * resultsRowsPerPage
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 dark:bg-[#070a13] text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300">
      
      {/* HEADER / NAVIGATION BAR */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 glass shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-500 to-pink-500 p-2.5 rounded-xl text-white shadow-md glow-primary">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400">
                GrowEasy AI
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">CRM CSV Importer</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Backend connection badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 text-xs font-semibold">
              <span className="relative flex h-2.5 w-2.5">
                {backendHealthy === true ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </>
                ) : backendHealthy === false ? (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                )}
              </span>
              <span>
                {backendHealthy === true 
                  ? `Connected (${apiProvider.toUpperCase()})` 
                  : backendHealthy === false 
                  ? 'Server Offline' 
                  : 'Connecting...'}
              </span>
            </div>

            {/* Connection settings dropdown */}
            <div className="relative group">
              <button className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/80 transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              <div className="absolute right-0 top-full mt-2 w-72 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 z-50">
                <h3 className="text-sm font-bold mb-3 text-slate-700 dark:text-slate-200">Server Configuration</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Backend Host URL</label>
                    <input
                      type="text"
                      value={backendUrl}
                      onChange={(e) => setBackendUrl(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>LLM Engine:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 uppercase">{apiProvider}</span>
                  </div>
                </div>
              </div>
            </div>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* STEP TRACKER PROGRESS BAR */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-8">
        <div className="relative">
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 rounded-full z-0"></div>
          <div 
            className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-indigo-500 to-pink-500 -translate-y-1/2 rounded-full transition-all duration-500 z-0"
            style={{ width: `${((step - 1) / 3) * 100}%` }}
          ></div>

          <div className="relative z-10 flex justify-between">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex flex-col items-center">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-md transition-all duration-300 ${
                    s < step 
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white scale-105' 
                      : s === step 
                      ? 'bg-white dark:bg-slate-900 border-2 border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 scale-110 ring-4 ring-indigo-500/10'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400'
                  }`}
                >
                  {s < step ? <Check className="w-5 h-5" /> : s}
                </div>
                <span className={`text-xs mt-2 font-semibold hidden md:block ${s === step ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400'}`}>
                  {s === 1 && 'Upload CSV'}
                  {s === 2 && 'Preview Data'}
                  {s === 3 && 'AI Processing'}
                  {s === 4 && 'CRM Dashboard'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">
        
        {/* STEP 1: UPLOAD CSV */}
        {step === 1 && (
          <div className="animate-fade-in space-y-8 max-w-3xl mx-auto w-full">
            {backendHealthy === false && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">Express Server Offline</h4>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    The backend Express API is not reachable at <code className="bg-red-500/20 px-1.5 py-0.5 rounded">{backendUrl}</code>. Make sure the backend server is running (<code className="bg-red-500/20 px-1.5 py-0.5 rounded">npm run dev</code> in the backend folder) and configured with API keys.
                  </p>
                </div>
              </div>
            )}

            <div className="text-center space-y-3">
              <h2 className="text-3xl font-extrabold tracking-tight">Intelligent AI CRM Lead Importer</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
                Upload lead sheets in any format (Facebook Ads, Google Ads, custom CRM exports). Our AI model automatically maps and standardizes them into GrowEasy format.
              </p>
            </div>

            {/* DRAG AND DROP ZONE */}
            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center ${
                isDragActive 
                  ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10 glow-primary scale-[1.01]' 
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-900/90'
              }`}
            >
              <input {...getInputProps()} />
              <div className="bg-gradient-to-tr from-indigo-500 to-pink-500 p-4 rounded-2xl text-white shadow-lg mb-4 glow-primary">
                <Upload className="w-7 h-7 animate-bounce" />
              </div>
              <h3 className="text-lg font-bold">Drag and drop your lead CSV here</h3>
              <p className="text-sm text-slate-400 mt-2">or click to browse from files</p>
              <div className="text-xs text-slate-400 mt-6 bg-slate-100 dark:bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                Supports file sizes up to 10MB
              </div>
            </div>

            {/* SAMPLE TEMPLATES */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-500" />
                Quick Test Sandbox (No file needed)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button 
                  onClick={() => loadSample('facebook')}
                  className="flex flex-col items-start p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-800/80 transition-all text-left group"
                >
                  <span className="font-bold text-sm text-slate-700 dark:text-slate-200">Facebook Lead Ads</span>
                  <span className="text-xs text-slate-400 mt-1">Messy phone formatting & custom column names</span>
                  <span className="text-xs text-indigo-500 font-semibold mt-3 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Load Template <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </button>

                <button 
                  onClick={() => loadSample('realestate')}
                  className="flex flex-col items-start p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-800/80 transition-all text-left group"
                >
                  <span className="font-bold text-sm text-slate-700 dark:text-slate-200">Real Estate CRM Sheet</span>
                  <span className="text-xs text-slate-400 mt-1">Timeline details & missing data rows</span>
                  <span className="text-xs text-indigo-500 font-semibold mt-3 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Load Template <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </button>

                <button 
                  onClick={() => loadSample('messy')}
                  className="flex flex-col items-start p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-800/80 transition-all text-left group"
                >
                  <span className="font-bold text-sm text-slate-700 dark:text-slate-200">Messy Agency Sheet</span>
                  <span className="text-xs text-slate-400 mt-1">Multiple emails, multiple phone fields</span>
                  <span className="text-xs text-indigo-500 font-semibold mt-3 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Load Template <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW RAW CSV DATA */}
        {step === 2 && (
          <div className="animate-fade-in space-y-6 max-w-7xl mx-auto w-full">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setStep(1)}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <FileText className="w-6 h-6 text-indigo-500" />
                    Preview Data: {fileName}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {records.length} records parsed locally. Verify the layout below before starting the AI conversion.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 md:flex-none px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={startImport}
                  disabled={backendHealthy === false}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-sm font-bold shadow-md glow-primary hover:scale-[1.02] transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  Confirm Import <Play className="w-4 h-4 fill-white" />
                </button>
              </div>
            </div>

            {/* RAW DATA TABLE */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm flex flex-col">
              <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
                <table className="w-full text-left border-collapse min-w-max relative">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-10">
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider sticky left-0 bg-slate-50 dark:bg-slate-900">#</th>
                      {headers.map((hdr) => (
                        <th key={hdr} className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{hdr}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {paginatedPreviewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-4 text-sm font-semibold text-slate-400 sticky left-0 bg-white dark:bg-slate-900">
                          {(previewPage - 1) * previewRowsPerPage + idx + 1}
                        </td>
                        {headers.map((hdr) => (
                          <td key={hdr} className="px-6 py-4 text-sm max-w-xs truncate text-slate-700 dark:text-slate-300">
                            {row[hdr] !== undefined ? String(row[hdr]) : <span className="text-slate-300 dark:text-slate-700">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* TABLE PAGINATION */}
              <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/20">
                <span className="text-xs text-slate-500">
                  Showing {(previewPage - 1) * previewRowsPerPage + 1} to {Math.min(previewPage * previewRowsPerPage, records.length)} of {records.length} records
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewPage(p => Math.max(p - 1, 1))}
                    disabled={previewPage === 1}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold">Page {previewPage} of {totalPreviewPages}</span>
                  <button
                    onClick={() => setPreviewPage(p => Math.min(p + 1, totalPreviewPages))}
                    disabled={previewPage === totalPreviewPages}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: PROCESSING / AI EXTRACTION */}
        {step === 3 && (
          <div className="animate-fade-in max-w-3xl mx-auto w-full space-y-8">
            <div className="text-center space-y-4">
              <div className="inline-flex relative items-center justify-center p-5 bg-gradient-to-tr from-indigo-500 to-pink-500 rounded-3xl text-white shadow-xl glow-primary">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight">AI Mapping Engine Running</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Processing your CRM leads in batches. Mapped data is structured using the {apiProvider.toUpperCase()} model.
              </p>
            </div>

            {/* PROGRESS BAR & STATS */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-indigo-500">Processing Batch {progress.currentBatch} of {progress.totalBatches}</span>
                <span className="font-bold">{progress.percentage}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                ></div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center">
                  <span className="text-xs text-slate-400 block">Total Mapped</span>
                  <span className="text-lg font-extrabold text-indigo-500">{crmRecords.length + skippedRecords.length}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center">
                  <span className="text-xs text-slate-400 block">Active Status</span>
                  <span className="text-xs font-bold text-amber-500 animate-pulse uppercase">Mapping Fields...</span>
                </div>
              </div>
            </div>

            {/* LIVE EXTRATION LOGS */}
            <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 shadow-lg flex flex-col">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">System Processing Logs</h3>
              <div className="h-64 overflow-y-auto font-mono text-xs text-indigo-400 space-y-2 no-scrollbar">
                {logs.map((log, idx) => (
                  <div key={idx} className="flex gap-2 items-start animate-fade-in">
                    <span className="text-slate-500 shrink-0 select-none">[{new Date().toLocaleTimeString()}]</span>
                    <span className={log.includes('[Warning]') ? 'text-amber-400' : log.includes('[Fatal Error]') ? 'text-red-400' : 'text-slate-300'}>
                      {log}
                    </span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: RESULT / CRM DASHBOARD */}
        {step === 4 && (
          <div className="animate-fade-in space-y-6 max-w-7xl mx-auto w-full">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <CheckCircle className="w-7 h-7 text-emerald-500" />
                  Conversion Completed!
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  AI successfully parsed and mapped {records.length} records into standard CRM schema.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> Start New
                </button>
                <button
                  onClick={exportCRMCSV}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-sm font-bold shadow-md glow-primary hover:scale-[1.02] transition-all"
                >
                  <Download className="w-4 h-4" /> Export CRM CSV
                </button>
              </div>
            </div>

            {/* DASHBOARD STATISTICS CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Total Evaluated</span>
                <span className="text-3xl font-extrabold block mt-2 text-slate-900 dark:text-white">{records.length}</span>
                <span className="text-xs text-slate-400 mt-1 block">rows parsed</span>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Successfully Mapped</span>
                <span className="text-3xl font-extrabold block mt-2 text-emerald-500">{crmRecords.length}</span>
                <span className="text-xs text-emerald-500/80 mt-1 block font-semibold">ready for CRM upload</span>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Skipped Leads</span>
                <span className="text-3xl font-extrabold block mt-2 text-red-500">{skippedRecords.length}</span>
                <span className="text-xs text-red-500/80 mt-1 block font-semibold">missing email & mobile</span>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Conversion Accuracy</span>
                <span className="text-3xl font-extrabold block mt-2 text-indigo-500">
                  {records.length > 0 ? Math.round((crmRecords.length / records.length) * 100) : 0}%
                </span>
                <span className="text-xs text-slate-400 mt-1 block">AI accuracy score</span>
              </div>
            </div>

            {/* TAB TOGGLES */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-2.5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl w-full md:w-auto">
                <button
                  onClick={() => { setResultsTab('success'); setResultsPage(1); }}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    resultsTab === 'success'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md scale-[1.02]'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" /> Successfully Mapped ({crmRecords.length})
                </button>
                <button
                  onClick={() => { setResultsTab('skipped'); setResultsPage(1); }}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    resultsTab === 'skipped'
                      ? 'bg-white dark:bg-slate-900 text-red-500 shadow-md scale-[1.02]'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" /> Skipped Leads ({skippedRecords.length})
                </button>
              </div>

              <div className="text-xs text-slate-400 font-semibold px-4">
                Showing fields mapped to GrowEasy CRM Lead Database schema.
              </div>
            </div>

            {/* CRM CONVERTED RESULTS TABLE */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm flex flex-col">
              <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
                <table className="w-full text-left border-collapse min-w-max relative">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-10">
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider sticky left-0 bg-slate-50 dark:bg-slate-900">#</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider sticky left-[48px] bg-slate-50 dark:bg-slate-900">Name</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Phone (Code + No)</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Company</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Data Source</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Possession Time</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">CRM Note</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Created At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {paginatedResultsRows.length > 0 ? (
                      paginatedResultsRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                          <td className="px-6 py-4 text-sm font-semibold text-slate-400 sticky left-0 bg-white dark:bg-slate-900">
                            {(resultsPage - 1) * resultsRowsPerPage + idx + 1}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white sticky left-[48px] bg-white dark:bg-slate-900">
                            {row.name || <span className="text-slate-300 dark:text-slate-700 italic">No Name</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                            {row.email || <span className="text-slate-300 dark:text-slate-700 italic">No Email</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                            {row.country_code && row.mobile_without_country_code ? (
                              <span>{row.country_code} {row.mobile_without_country_code}</span>
                            ) : row.mobile_without_country_code ? (
                              <span>{row.mobile_without_country_code}</span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700 italic">No Mobile</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                            {row.company || <span className="text-slate-300 dark:text-slate-700">—</span>}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                              row.crm_status === 'GOOD_LEAD_FOLLOW_UP' ? 'bg-indigo-500/10 text-indigo-500' :
                              row.crm_status === 'SALE_DONE' ? 'bg-emerald-500/10 text-emerald-500' :
                              row.crm_status === 'BAD_LEAD' ? 'bg-red-500/10 text-red-500' :
                              'bg-amber-500/10 text-amber-500'
                            }`}>
                              {row.crm_status ? row.crm_status.replace(/_/g, ' ') : '—'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                            {row.data_source ? (
                              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">
                                {row.data_source}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                            {row.possession_time || <span className="text-slate-300 dark:text-slate-700">—</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 max-w-xs truncate" title={row.crm_note || ''}>
                            {row.crm_note || <span className="text-slate-300 dark:text-slate-700">—</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                            {row.created_at || <span className="text-slate-300 dark:text-slate-700">—</span>}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10} className="px-6 py-12 text-center text-slate-400 text-sm font-semibold italic">
                          No leads in this category.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* TABLE PAGINATION */}
              {activeResultsList.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/20">
                  <span className="text-xs text-slate-500">
                    Showing {(resultsPage - 1) * resultsRowsPerPage + 1} to {Math.min(resultsPage * resultsRowsPerPage, activeResultsList.length)} of {activeResultsList.length} records
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setResultsPage(p => Math.max(p - 1, 1))}
                      disabled={resultsPage === 1}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold">Page {resultsPage} of {totalResultsPages}</span>
                    <button
                      onClick={() => setResultsPage(p => Math.min(p + 1, totalResultsPages))}
                      disabled={resultsPage === totalResultsPages}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="w-full border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#070a13] py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            &copy; {new Date().getFullYear()} GrowEasy CRM. Built with AI. All rights reserved.
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 text-slate-500 font-semibold">
              Applying for: Software Developer Intern
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <a href="mailto:varun@groweasy.ai" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors font-medium">varun@groweasy.ai</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
