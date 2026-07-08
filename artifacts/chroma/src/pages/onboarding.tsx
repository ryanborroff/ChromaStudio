import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey, useUpdateMe } from "@workspace/api-client-react";
import { Loader2, Clapperboard, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploader } from "@/components/ImageUploader";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

const PROFESSIONS = [
  "Director",
  "Cinematographer",
  "Editor",
  "Producer",
  "Writer",
  "Composer",
  "Sound Designer",
  "Colourist",
  "Production Designer",
  "Student",
  "Other",
];

const STEPS = ["Identity", "Your story", "Find your place"];

export function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

  const [step, setStep] = useState(0);
  const [profession, setProfession] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [location_, setLocation_] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");

  useEffect(() => {
    if (user) {
      if (user.profession) {
        setLocation("/feed");
        return;
      }
      setAvatarUrl(user.avatarUrl || "");
    }
  }, [user, setLocation]);

  const updateMutation = useUpdateMe({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/feed");
        toast({ title: "Welcome to ChromaStudio! Your profile is ready." });
      },
      onError: () => {
        toast({ title: "Something went wrong. You can finish your profile later.", variant: "destructive" });
        setLocation("/feed");
      },
    },
  });

  function handleFinish() {
    updateMutation.mutate({
      data: {
        profession,
        avatarUrl,
        location: location_,
        bio,
        website,
      },
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <Clapperboard className="h-10 w-10 text-primary mx-auto mb-4" strokeWidth={2.5} />
          <h1 className="text-3xl font-black text-white tracking-tight">Set up your profile</h1>
          <p className="text-white/45 mt-2">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-white/10 rounded-full mb-8">
          <div
            className="h-1 bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step content */}
        <div className="bg-card border border-border/50 rounded-2xl p-8 space-y-6">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">What do you do?</label>
                <Select value={profession} onValueChange={setProfession}>
                  <SelectTrigger className="bg-input border-border text-white h-12">
                    <SelectValue placeholder="Select your profession" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROFESSIONS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ImageUploader
                label="Profile photo"
                variant="avatar"
                value={avatarUrl}
                onChange={setAvatarUrl}
              />
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">Bio</label>
                <Textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell the industry about yourself — your style, experience, what you're looking for..."
                  className="bg-input border-border text-white min-h-[140px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">Website</label>
                <Input
                  type="url"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder="https://"
                  className="bg-input border-border text-white"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">Where are you based?</label>
                <Input
                  value={location_}
                  onChange={e => setLocation_(e.target.value)}
                  placeholder="e.g. Los Angeles, CA"
                  className="bg-input border-border text-white"
                />
                <p className="text-xs text-white/30">This helps other filmmakers find local collaborators.</p>
              </div>

              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
                <p className="text-sm text-white/50 leading-relaxed">
                  You can always update your profile, add social links, upload a cover photo, and more from your profile settings.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          {step > 0 ? (
            <Button
              variant="ghost"
              onClick={() => setStep(s => s - 1)}
              className="text-white/50 hover:text-white gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          ) : (
            <button
              type="button"
              onClick={() => setLocation("/feed")}
              className="text-sm text-white/30 hover:text-white/60 transition-colors"
            >
              Skip for now
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 0 && !profession}
              className="gap-1.5 font-semibold"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={updateMutation.isPending}
              className="font-semibold"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Go to ChromaStudio
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
