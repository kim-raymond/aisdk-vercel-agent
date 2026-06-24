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
    <div className="flex flex-col gap-[1.2rem] bg-stone-900 border border-stone-800 rounded-xl h-screen p-4 text-stone-50">
      <h3 className="text-xs font-bold text-stone-400 tracking-wider uppercase p-2">Database Assets</h3>
      <section className="text-[11px] flex flex-col gap-2">
        {(instruments??[]).map(record =>(
          <div key={record.id} className="grid grid-cols-5 gap-2.5 px-[1rem] py-[0.75rem] bg-stone-950 rounded-[0.75rem]">
            <p className="col-span-2"><span className="text-emerald-600">Device: </span>{record.name}</p>
            <p className="col-span-2"><span className="col-span-2 text-emerald-600">Status: </span>{record.status}</p>
            <p><span className="text-emerald-600 ">Qty: </span>{record.quantity}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
// export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="flex relative justify-center items-center w-full py-12 px-4 gap-4 min-h-screen font-poppins">
      
      <div className="flex flex-col gap-2 absolute left-0 top-0">
        <Suspense fallback={<div className="text-sm text-stone-500">Loading instruments database...</div>}>
          <InstrumentsData />
        </Suspense>
      </div>

      {/* Passing control down cleanly to our operational client canvas layer */}
      <ChatInterface />
    </div>
  );
}