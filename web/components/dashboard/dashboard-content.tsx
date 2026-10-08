        <section aria-labelledby="home-greeting" className="pb-6">
          <h1
            id="home-greeting"
            className="text-2xl font-semibold tracking-tight sm:text-[26px]"
          >
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Continue where you left off or start something new.
          </p>
        </section>

        <section aria-labelledby="continue-working" className="space-y-3">
          <SectionHeader title="Continue Working" href="/app/projects" />
          {projectError ? (
            <div className="flex min-h-32 items-center justify-between rounded-xl border bg-card px-4 py-4 sm:px-5">
              <p role="alert" className="text-sm text-muted-foreground">{projectError}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void fetchProjects()}>
                Retry
              </Button>
            </div>
          ) : projects === null ? (
            <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="min-w-[280px] shrink-0 overflow-hidden rounded-xl border bg-card sm:min-w-0">
                  <Skeleton className="aspect-[16/9] w-full rounded-none" />
                  <div className="space-y-2 p-3.5">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="flex min-h-32 flex-col items-start justify-center gap-3 rounded-xl border bg-card px-5 py-5 sm:px-6">
              <div>
                <p className="text-sm font-semibold">Start your first project</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create a project to keep your renders, videos and assets together.
                </p>
              </div>
              <Button asChild size="sm">
                <Link href="/app/projects">Create project</Link>
              </Button>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible xl:grid-cols-3">
              {recentProjects.map((project) => (
                <div key={project.id} className="min-w-[280px] shrink-0 sm:min-w-0">
                  <ProjectCard project={project} layout="grid" home />
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="start-workflow" className="mt-8 space-y-3">
          <WorkflowSectionHeader />
          <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible xl:grid-cols-3">
            {WORKFLOWS.map((workflow) => (
              <div key={workflow.href} className="min-w-[280px] shrink-0 sm:min-w-0">
                <WorkflowCard {...workflow} />
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="recent-work" className="mt-8 space-y-3 pb-8">
          <SectionHeader title="Recent Work" href="/app/projects" />
          {assetError ? (
            <div className="flex min-h-32 items-center justify-between rounded-xl border bg-card px-4 py-4 sm:px-5">
              <p role="alert" className="text-sm text-muted-foreground">{assetError}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void fetchAssets()}>
                Retry
              </Button>
            </div>
          ) : assets === null ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="aspect-[4/3] w-full rounded-xl" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border bg-card px-5 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <Wand2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">No work yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your generated images and videos will appear here.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild size="sm">
                  <Link href="/app/ai-image-generator">
                    <ImageIcon className="mr-1.5 h-4 w-4" />
                    Start a Render
                  </Link>
                </Button>
                <ToolPickerPopover defaultTab="image" placement="bottom">
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Explore tools
                  </button>
                </ToolPickerPopover>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {assets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} onChanged={fetchAssets} compact />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function WorkflowSectionHeader() {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold tracking-wide">Start a Workflow</h2>
      <ToolPickerPopover defaultTab="image" placement="bottom">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </ToolPickerPopover>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        View all
        <ArrowRight className="h-3.5 w-3.5" />