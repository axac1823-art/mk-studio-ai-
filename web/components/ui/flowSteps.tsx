
import { WORKFLOW_STEPS } from "./workflow";

export default function WorkflowSteps() {
  return (
    <div
      className="
        order-2
        flex
        flex-col
        justify-center
        space-y-2

        lg:order-1
        lg:col-span-4
        lg:space-y-5
      "
    >
      {WORKFLOW_STEPS.map((step) => (
        <div
          key={step.id}
          data-workflow-step
          className="
            workflow-step
            relative
            border-l-2
            py-2
            pl-4
            transition-all
            duration-500
            sm:pl-6
          "
        >
          <div
            className="
              mb-1
              flex
              items-center
              gap-3
              font-mono
              text-[9px]
              tracking-[0.16em]
              text-[hsl(189.16deg_79.17%_47.06%)]
            "
          >
            <span>{step.phase}</span>
            <span className="text-black/20 dark:text-white/20">•</span>
            <span className="text-black/40 dark:text-white/35">
              {step.subtitle}
            </span>
          </div>

          <h3
            className="
              mb-1
              text-base
              font-medium
              text-black
              dark:text-white
              sm:text-lg
              md:text-xl
            "
          >
            {step.title}
          </h3>

          <p
            className="
              hidden
              text-xs
              font-light
              leading-relaxed
              text-black/45
              dark:text-white/40
              sm:block
              md:text-sm
            "
          >
            {step.description}
          </p>
        </div>
      ))}
    </div>
  );
}