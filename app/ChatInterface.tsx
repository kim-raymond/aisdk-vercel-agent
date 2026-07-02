'use client';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {motion} from 'motion/react';


type PdfAttachment = {
  name: string;
  url: string;
};

export default function Chat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat();

  const router = useRouter();

  // Track last-seen tool response to avoid repeated refreshes
  const lastToolResponseRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // PDF UPLOAD — state, refs, loading flags, and progress
  const [pdfAttachment, setPdfAttachment] = useState<PdfAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [startedChat, setStartedChat] = useState(false);

  // Use a ref to store the active XMLHttpRequest instance so it can be aborted from anywhere
  const activeXhrRef = useRef<XMLHttpRequest | null>(null);

  // PDF UPLOAD — uploads file to Supabase Storage with live progress & cancel capabilities
  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Quick client-side size check to avoid very large uploads
    const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_SIZE_BYTES) {
      const allow = window.confirm(
        `The file "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Uploading large PDFs can take a long time. Continue?`
      );
      if (!allow) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    console.time('pdf-upload');
    setUploading(true);
    setUploadProgress(0);

    try {
      const supabase = createClient();
      const filename = `${Date.now()}-${file.name}`;

      // 1. Resolve session credentials and build the target REST API URL for Supabase Storage
      const { data: { session } } = await supabase.auth.getSession();
      const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const uploadUrl = `${projectUrl}/storage/v1/object/pdfs/${filename}`;

      if (!projectUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");

      // 2. Perform native XHR upload to intercept progress events smoothly
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        activeXhrRef.current = xhr; // Store instance reference globally for the abort controller

        xhr.open('POST', uploadUrl, true);

        // Required API Authentication Headers
        xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token || ''}`);
        xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
        xhr.setRequestHeader('x-upsert', 'false');

        // Track live stream transmission values
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percentage);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
          } else {
            reject(new Error(`Storage server returned error code ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network connectivity issue during upload'));
        xhr.onabort = () => reject(new Error('Upload canceled by user'));

        xhr.send(file);
      });

      // 3. Assemble target public asset URL instantly without additional database queries
      const publicUrl = supabase.storage
        .from('pdfs')
        .getPublicUrl(filename).data.publicUrl;

      setPdfAttachment({ name: file.name, url: publicUrl });
      console.timeEnd('pdf-upload');
    } catch (err: any) {
      // Avoid popups when users explicitly hit cancel
      if (err.message !== 'Upload canceled by user') {
        console.error('PDF upload failed:', err);
        alert('Failed to upload PDF. Please try again.');
      }
      setPdfAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setUploading(false);
      setUploadProgress(0);
      activeXhrRef.current = null;
    }
  };

  // Cancels active HTTP stream pipelines instantly
  const handleCancelUpload = () => {
    if (activeXhrRef.current) {
      activeXhrRef.current.abort();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !pdfAttachment) return;
    if (uploading) return;

    sendMessage({
      parts: [
        { type: 'text', text: input },
        ...(pdfAttachment
          ? [
              {
                type: 'data-pdf' as const,
                data: {
                  name: pdfAttachment.name,
                  url: pdfAttachment.url,
                },
              },
            ]
          : []),
      ],
    });

    setInput('');
    setPdfAttachment(null);
    setStartedChat(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isStreaming = status === 'streaming';
  const isSubmitted = status === 'submitted';
  const isBusy = isStreaming || isSubmitted;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSubmitted]);

  // trigger a refresh of server components when our DB tool finishes
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (typeof part.type === 'string' && (part.type === 'tool-addInstrumentToDatabase' || part.type === 'tool-deleteInstrumentFromDatabase')) {
          const uniqueId = `${msg.id}-${part.type}`;
          if (lastToolResponseRef.current === uniqueId) return;
          lastToolResponseRef.current = uniqueId;
          try {
            const payload = (part as any).result ?? (part as any).data ?? (part as any);
            if (!payload || payload.success === undefined || payload.success) {
              router.refresh();
            }
          } catch (err) {
            router.refresh();
          }
          return;
        }
      }
    }
  }, [messages, router]);

  // for motion section
  const header = `Ready When You Are`.split(/(\s+)/);
  return (
    <div className="flex flex-col w-full max-w-md justify-around">

      <div className="relative ">
        <div className="flex h-[80vh] overflow-y-auto scrollbar-thin scrollbar-track-background flex-col gap-4">
          
          {startedChat || isStreaming ? null : (
            <div className="relative flex flex-col justify-center items-center">
              <div className="-z-1 absolute w-[19rem] h-[3rem] blur-2xl mx-auto bg-radial from-pink-400 from-50% to-fuchsia-700"></div>
              <div className="flex flex-col justify-center items-center text-center gap-4 h-[50vh]">
                {/* <h2 className='dark:text-stone-200 text-stone-700 text-4xl font-bold'>Ready When You Are</h2> */}
                <div className="flex justify-center ">
                {header.map((l,i)=>(
                  <motion.h2 
                  initial={{opacity:0,y:10}}
                  animate={{opacity:1,y:0}}
                  transition={{delay:i*0.05,duration:0.1,ease:'easeIn'}}
                    key={i}
                    className=" text-[2.5rem] font-bold dark:text-stone-200 text-stone-700 text-4xl"
                  >
                    {l === " "? "\u00A0": l}
                  </motion.h2>
                ))}
                </div>
                <motion.p 
                initial={{opacity:0,}}
                animate={{opacity:1}}
                transition={{delay:0.5,duration:0.1,ease:'easeIn'}}
                className='text-stone-600 dark:text-stone-300'>
                  Ask me to manage your records, analyze PDF files, and check your location's current weather!
                </motion.p>
              </div>
            </div>
          )}

          {messages.map(message => (
            <div key={message.id}>
              {message.parts.map((part, i) => {
                switch (part.type) {
                  case 'text':
                    return (
                      <div
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        key={`${message.id}-${i}`}
                      >
                        <p className={`${message.role === 'user' ? 'text-right text-stone-100 bg-stone-800' : 'text-stone-900 bg-stone-100'} rounded-2xl px-[1rem] py-[0.75rem] leading-[1.25rem] max-w-[24rem]`}>
                          {part.text}
                          {message.role === 'assistant' &&
                            isStreaming &&
                            i === message.parts.length - 1 && (
                              <span className="inline-block w-[2px] h-[1em] bg-stone-500 animate-pulse align-middle" />
                            )}
                        </p>
                      </div>
                    );

                  case 'tool-weather':
                  case 'tool-convertFahrenheitToCelsius':
                    return <pre key={`${message.id}-${i}`}></pre>;
                  default:
                    return null;
                }
              })}
            </div>
          ))}

          {isSubmitted && (
            <div className="flex justify-start">
              <div className="px-[1rem] py-[0.75rem] max-w-[18rem] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-stone-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-stone-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-stone-400 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-2 pointer-events-none bg-gradient-to-t dark:from-stone-950 to-transparent from-white to-transparent"></div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* PDF UPLOAD — Live progress layout bar containing individual cancel buttons */}
        {(pdfAttachment || uploading) && (
          <div className="fixed bottom-24 max-w-md w-full flex flex-col gap-1.5 bg-stone-800 text-white text-sm px-4 py-3 rounded-xl shadow border border-stone-700">
            <div className="flex items-center gap-2">
              <span>📄</span>
              <span className="truncate flex-1 font-medium">
                {uploading ? `Uploading File (${uploadProgress}%)` : pdfAttachment?.name}
              </span>
              
              {uploading ? (
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="text-red-400 hover:text-red-300 font-semibold px-2 py-0.5 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition text-xs"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPdfAttachment(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-stone-400 hover:text-white transition ml-2 font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {uploading && (
              <div className="w-full bg-stone-700 rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className="bg-sky-500 h-1.5 rounded-full transition-all duration-150 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            )}
          </div>
        )}

        <div className="w-full max-w-md flex items-center gap-3 border border-zinc-500 rounded-full shadow-xl px-[0.875rem] py-[0.5rem] dark:bg-zinc-900">
          <label className={`cursor-pointer text-center transition w-[1.2rem] font-bold text-lg
            ${uploading || isBusy ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:text-white'}`}>
            {uploading ? '⏳' : '+'}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={uploading || isBusy}
              onChange={handlePdfChange}
            />
          </label>

          <input
            className="flex-1 bg-transparent outline-none text-stone-100"
            value={input}
            placeholder={uploading ? 'Uploading PDF...' : isBusy ? 'Waiting for response...' : 'Say something...'}
            onChange={e => setInput(e.currentTarget.value)}
            disabled={isBusy}
          />

          <button
            type="submit"
            disabled={uploading || isBusy || (!input.trim() && !pdfAttachment)}
            className="text-zinc-400 bg-stone-800 w-[2rem] h-[2rem] flex items-center justify-center rounded-full hover:text-white transition disabled:opacity-40"
          >
            {isBusy ? '⏳' : '↑'}
          </button>
        </div>
      </form>
    </div>
  );
}