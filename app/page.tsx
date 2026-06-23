import { createClient } from "@/lib/supabase/server";
import { redirect } from 'next/navigation'
import { Suspense } from "react";
import ChatInterface from "./ChatInterface"; 

async function InstrumentsData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser()

  // If no user exists in cookies, kick them to login
  if (!user) {
    redirect('/login')
  }

  interface Instrument{
    id:string,
    name:string,
    status:string,
    quantity:string,
    created_at:string,
  }

  const { data: instruments, error } = await supabase.from('instruments').select() as {data: Instrument[] | null, error: any};

  // Good practice: debug if there's an RLS or schema issue
  if (error) {
    console.error("Supabase Error:", error.message)
  }
  
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 ">
      <h3 className="text-xs font-bold text-stone-400 tracking-wider uppercase p-2">Database Assets</h3>
      <section className="text-[11px]">
        {(instruments??[]).map(record =>(
          <div key={record.id} className="flex gap-2 px-1 py-1">
            <p><span className="text-emerald-600">Device: </span>{record.name}</p>
            <p><span className="text-emerald-600">Status: </span>{record.status}</p>
            <p><span className="text-emerald-600">Qty: </span>{record.quantity}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
// export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="flex w-full py-12 px-4 gap-4 min-h-screen">
      
      <div className="flex flex-col gap-2 ">
        <Suspense fallback={<div className="text-sm text-stone-500">Loading instruments database...</div>}>
          <InstrumentsData />
        </Suspense>
      </div>

      {/* Passing control down cleanly to our operational client canvas layer */}
      <ChatInterface />
    </div>
  );
}