import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";

interface Props {
  challengeName: string;
  onOpenCardDetail: () => void;
  onDone: () => void;
}

export function ChallengeCreatedSuccess({ challengeName, onOpenCardDetail, onDone }: Props) {
  return (
    <div className="text-center py-6 px-4 space-y-5 text-foreground">
      <div className="w-14 h-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mx-auto shadow-xs border border-primary/30">
        <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
      </div>

      <div className="space-y-1.5 max-w-md mx-auto">
        <h3 className="text-xl font-bold text-foreground">Challenge Successfully Created</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">"{challengeName}"</strong> is now live in your
          community directory.
        </p>
      </div>

      <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/25 text-primary text-xs text-left max-w-md mx-auto flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-bold text-foreground">Creator Edit Window Active</p>
          <p className="text-muted-foreground leading-relaxed">
            Your schedule routine remains freely editable until the very first member joins. Once
            someone enrolls, the routine will lock automatically to maintain competitive fairness.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-sm mx-auto">
        <button
          type="button"
          onClick={onOpenCardDetail}
          className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs tracking-wide shadow-xs flex items-center justify-center gap-2 transition-colors"
        >
          <span>Open Challenge Detail</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onDone}
          className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-foreground font-semibold text-xs transition-colors"
        >
          Return to Directory
        </button>
      </div>
    </div>
  );
}
