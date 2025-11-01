import Image from 'next/image'

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col p-6">
      <div className="flex h-20 shrink-0 items-end rounded-lg bg-blue-500 p-4 md:h-52">
        <Image src="/vercel.svg" alt="Logo" width={100} height={100} />
      </div>
    </main>
  )
}
