import FileUpload from "@/components/file-upload";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-20">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xl text-center md:text-left">
            <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Appeal Shark
            </span>
            <h1 className="mt-4 text-4xl font-bold md:text-5xl">
              Challenge your property tax assessment with AI-driven guidance.
            </h1>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
              Upload your assessment, compare market value insights, and download a county-ready
              appeal letter in minutes.
            </p>
            <p className="mt-6 text-sm text-slate-500">
              Your documents stay encrypted at rest in Supabase Storage. Only you can access them
              once authentication is enabled.
            </p>
          </div>
          <div className="flex justify-center md:justify-end">
            <FileUpload />
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-500">
            Need to see how the full flow works? Explore our guided demo experience.
          </div>
          <button className="rounded-full border border-foreground px-6 py-3 text-base font-semibold transition hover:bg-foreground/10">
            Explore Demo
          </button>
        </div>
      </section>
    </main>
  );
}
