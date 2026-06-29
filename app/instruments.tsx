'use client'
import {useState} from 'react'
type Instrument = {
  id: string | number
  name: string
  status: string
  quantity: number
}

type InstrumentsProps = {
  instruments?: Instrument[]
}

export default function Instruments({ instruments = [] }: InstrumentsProps) {
  const [openSideBar, setOpenSideBar] = useState(true);
  const handleClickedSideBar =()=>{
    setOpenSideBar(stat=>!stat)
  }
  return (
    <div className={`flex flex-col gap-4`}>

    <div className="flex text-[0.75rem] px-2 w-full justify-between">
    <h2 className={`${openSideBar ? '':'hidden'}`}>DATABASE</h2>
    <button onClick={handleClickedSideBar}
    className="px-2 text-center cursor-pointer text-stone-400">

    { openSideBar ?
      <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-layout-sidebar-left-collapse">
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" />
      <path d="M9 4v16" />
      <path d="M15 10l-2 2l2 2" />
    </svg>
        :
      <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-layout-sidebar-right-collapse">
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" />
      <path d="M15 4v16" />
      <path d="M9 10l2 2l-2 2" />
    </svg>

    }
    </button>
    </div>

    <section className={`${openSideBar ? '' : 'hidden'} text-[11px] flex flex-col gap-2`}>
        {instruments.map(record => (
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