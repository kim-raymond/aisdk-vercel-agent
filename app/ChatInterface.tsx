'use client';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type PdfAttachment = {
  name: string;
  url: string;
};

export default function Chat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat(); // ← added status

  const router = useRouter();

  // Track last-seen tool response to avoid repeated refreshes
  const lastToolResponseRef = useRef<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // PDF UPLOAD — state, ref, and loading flag
  const [pdfAttachment, setPdfAttachment] = useState<PdfAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // PDF UPLOAD — uploads file to Supabase Storage and stores the URL
  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Quick client-side size check to avoid very large uploads
    const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_SIZE_BYTES) {
      const allow = window.confirm(
        `The file "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Uploading large PDFs can take a long time. Continue?`
      );
      if (!allow) return;
    }

    console.time('pdf-upload');
    setUploading(true);
    try {
      const supabase = createClient();
      const filename = `${Date.now()}-${file.name}`;

      const { error } = await supabase.storage
        .from('pdfs')
        .upload(filename, file, { contentType: 'application/pdf' });

      if (error) throw error;

      const { data: signedData, error: signedError } = await supabase.storage
        .from('pdfs')
        .createSignedUrl(filename, 60 * 60);

      if (signedError) throw signedError;

      setPdfAttachment({ name: file.name, url: signedData.signedUrl });
      console.timeEnd('pdf-upload');
    } catch (err) {
      console.error('PDF upload failed:', err);
      alert('Failed to upload PDF. Please try again.');
    } finally {
      setUploading(false);
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ============================================================
  // STREAMING — derive booleans from status for clarity
  // ============================================================
  const isStreaming = status === 'streaming';
  const isSubmitted = status === 'submitted'; // sent but not yet streaming
  const isBusy = isStreaming || isSubmitted;
  // ============================================================

  useEffect(()=>{
    messagesEndRef.current?.scrollIntoView({behavior:'smooth'});
  }, [messages, isSubmitted]);

  // Trigger a refresh of server components when our DB tool finishes
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (typeof part.type === 'string' && part.type === 'tool-addInstrumentToDatabase'|| 'tool-deleteInstrumentFromDatabase') {
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

  return (
    <div className="flex flex-col w-full max-w-md gap-4 justify-around">
      <div className="relative">
      <div className="flex h-[80vh] overflow-y-auto scrollbar-hide flex-col gap-4">
      {messages.map(message => (
        <div key={message.id} className="">
          {message.parts.map((part, i) => {
            switch (part.type) {
              case 'text':
                return (
                  <div
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    key={`${message.id}-${i}`}
                  >
                    <p className={`${message.role === 'user' ? 'text-right bg-stone-800' : 'text-stone-900 border bg-stone-100'} rounded-2xl px-[1rem] py-[0.75rem] leading-[1.25rem] max-w-[24rem]`}>
                      {part.text}

                      {/* ============================================================
                          STREAMING — blinking cursor shown while this message
                          is the last assistant message and still streaming
                      ============================================================ */}
                      {message.role === 'assistant' &&
                        isStreaming &&
                        i === message.parts.length - 1 && (
                          <span className="inline-block w-[2px] h-[1em] bg-stone-500 animate-pulse align-middle" />
                        )}
                      {/* ============================================================ */}
                    </p>
                  </div>
                );

              case 'tool-weather':
              case 'tool-convertFahrenheitToCelsius':
                return (
                  <pre key={`${message.id}-${i}`}>
                    {JSON.stringify(part, null, 2)}
                  </pre>
                );
            }
          })}
        </div>
      ))}

      {/* STREAMING — "thinking" bubble shown before first token arrives */}
      {isSubmitted && (
        <div className="flex justify-start">
          <div className="bg-stone-100 border text-stone-900 rounded-2xl px-[1rem] py-[0.75rem] max-w-[18rem] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-stone-400 animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-stone-400 animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-stone-400 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-4 pointer-events-none bg-gradient-to-t from-stone-950 to-transparent">
      </div>

    </div>
      {/* This closes your overflow-y-auto container layout */}

      {/* ============================================================ */}

      <form onSubmit={handleSubmit}>

        {/* PDF UPLOAD — preview bar with uploading state */}
        {(pdfAttachment || uploading) && (
          <div className="fixed bottom-20 max-w-md w-full flex items-center gap-2 bg-stone-800 text-white text-sm px-4 py-2 rounded-xl shadow">
            <span>📄</span>
            <span className="truncate flex-1">
              {uploading ? 'Uploading...' : pdfAttachment?.name}
            </span>
            {!uploading && (
              <button
                type="button"
                onClick={() => {
                  setPdfAttachment(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-stone-400 hover:text-white ml-2"
              >
                ✕
              </button>
            )}
          </div>
        )}

        <div className="fixed bottom-0 w-full max-w-md mb-8 flex items-center gap-2 border border-zinc-500 rounded-full shadow-xl px-[1.2rem] py-[0.5rem] dark:bg-zinc-900">

          {/* PDF UPLOAD — paperclip button, disabled while uploading or streaming */}
          <label className={`cursor-pointer transition ${uploading || isBusy ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:text-white'}`}>
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
            className="flex-1 bg-transparent outline-none"
            value={input}
            placeholder={uploading ? 'Uploading PDF...' : isBusy ? 'Waiting for response...' : 'Say something...'}
            onChange={e => setInput(e.currentTarget.value)}
            disabled={isBusy}
          />

          {/* ============================================================
              STREAMING — send button shows a stop/spinner while busy
          ============================================================ */}
          <button
            type="submit"
            disabled={uploading || isBusy}
            className="text-zinc-400 hover:text-white transition disabled:opacity-40"
          >
            {isBusy ? '⏳' : '➤'}
          </button>
          {/* ============================================================ */}

        </div>

      </form>
    </div>
  );
}