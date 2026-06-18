import { useGetMe, getGetMeQueryKey, useUpdateMe } from "@workspace/api-client-react";
import { Loader2, Instagram, Linkedin, Twitter, Film, Clapperboard, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ImageUploader } from "@/components/ImageUploader";
import { useEffect, useRef, useState } from "react";

type CreditItem = { title: string; role: string; year: string };

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

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  profession: z.string().min(1, "Profession is required"),
  bio: z.string().optional(),
  location: z.string().optional(),
  website: z.string().optional(),
  instagram: z.string().optional(),
  linkedin: z.string().optional(),
  twitter: z.string().optional(),
  vimeo: z.string().optional(),
  imdb: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileEdit() {
  const { toast } = useToast();
  const { data: user, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey() }
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      profession: "",
      bio: "",
      location: "",
      website: "",
      instagram: "",
      linkedin: "",
      twitter: "",
      vimeo: "",
      imdb: "",
    },
  });

  const initRef = useRef(false);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [credits, setCredits] = useState<CreditItem[]>([]);
  const [newCredit, setNewCredit] = useState<CreditItem>({ title: "", role: "", year: "" });

  useEffect(() => {
    if (user && !initRef.current) {
      const links = (user.socialLinks as Record<string, string> | null) ?? {};
      form.reset({
        name: user.name || "",
        profession: user.profession || "",
        bio: user.bio || "",
        location: user.location || "",
        website: user.website || "",
        instagram: links.instagram || "",
        linkedin: links.linkedin || "",
        twitter: links.twitter || "",
        vimeo: links.vimeo || "",
        imdb: links.imdb || "",
      });
      setAvatarUrl(user.avatarUrl || "");
      setCoverUrl(user.coverUrl || "");
      const rawCredits = user.credits;
      if (Array.isArray(rawCredits)) {
        setCredits(rawCredits.map((c: any) => ({
          title: c.title || "",
          role: c.role || "",
          year: c.year || "",
        })));
      }
      initRef.current = true;
    }
  }, [user, form]);

  function addCredit() {
    if (!newCredit.title.trim() || !newCredit.role.trim()) return;
    setCredits(prev => [...prev, { ...newCredit }]);
    setNewCredit({ title: "", role: "", year: "" });
  }

  function removeCredit(index: number) {
    setCredits(prev => prev.filter((_, i) => i !== index));
  }

  const updateMutation = useUpdateMe({
    mutation: {
      onSuccess: () => {
        toast({ title: "Profile updated successfully" });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to update profile", variant: "destructive" });
      }
    }
  });

  function onSubmit(data: ProfileFormValues) {
    const { instagram, linkedin, twitter, vimeo, imdb, ...rest } = data;
    const socialLinks: Record<string, string> = {};
    if (instagram) socialLinks.instagram = instagram;
    if (linkedin) socialLinks.linkedin = linkedin;
    if (twitter) socialLinks.twitter = twitter;
    if (vimeo) socialLinks.vimeo = vimeo;
    if (imdb) socialLinks.imdb = imdb;

    updateMutation.mutate({
      data: {
        ...rest,
        avatarUrl,
        coverUrl,
        socialLinks,
        credits: credits.map(c => ({ title: c.title, role: c.role, ...(c.year ? { year: c.year } : {}) })),
      },
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-black text-white tracking-tight mb-8">Edit Profile</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

          <div className="bg-card border border-border/50 rounded-xl p-6 space-y-6">
            <h2 className="text-sm font-semibold text-white/40 uppercase tracking-widest">Identity</h2>

            <ImageUploader
              label="Cover Image"
              variant="wide"
              value={coverUrl}
              onChange={setCoverUrl}
            />

            <ImageUploader
              label="Profile Photo"
              variant="avatar"
              value={avatarUrl}
              onChange={setAvatarUrl}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Full Name</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-input border-border text-white" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="profession"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Profession</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-input border-border text-white">
                        <SelectValue placeholder="Select your profession" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROFESSIONS.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Location</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Los Angeles, CA" className="bg-input border-border text-white" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Website</FormLabel>
                  <FormControl>
                    <Input {...field} type="url" placeholder="https://" className="bg-input border-border text-white" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Bio</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      className="bg-input border-border text-white min-h-[120px]"
                      placeholder="Tell the industry about yourself..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="bg-card border border-border/50 rounded-xl p-6 space-y-6">
            <h2 className="text-sm font-semibold text-white/40 uppercase tracking-widest">Social Links</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="instagram"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white flex items-center gap-2">
                      <Instagram className="w-4 h-4 text-white/50" /> Instagram
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="@username" className="bg-input border-border text-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="linkedin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white flex items-center gap-2">
                      <Linkedin className="w-4 h-4 text-white/50" /> LinkedIn
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="linkedin.com/in/..." className="bg-input border-border text-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="twitter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white flex items-center gap-2">
                      <Twitter className="w-4 h-4 text-white/50" /> X / Twitter
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="@username" className="bg-input border-border text-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vimeo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white flex items-center gap-2">
                      <Film className="w-4 h-4 text-white/50" /> Vimeo
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="vimeo.com/..." className="bg-input border-border text-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="imdb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white flex items-center gap-2">
                      <Clapperboard className="w-4 h-4 text-white/50" /> IMDb
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="imdb.com/name/..." className="bg-input border-border text-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Credits */}
          <div className="bg-card border border-border/50 rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-white/40 uppercase tracking-widest">Film Credits</h2>
              <p className="text-xs text-white/30 mt-1">Add productions you've worked on — they appear on your public profile.</p>
            </div>

            {/* Existing credits list */}
            {credits.length > 0 && (
              <div className="space-y-2">
                {credits.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/30">
                    <Clapperboard className="w-4 h-4 text-primary/50 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{c.title}</p>
                      <p className="text-white/40 text-xs">{c.role}{c.year ? ` · ${c.year}` : ""}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-white/30 hover:text-red-400 shrink-0"
                      onClick={() => removeCredit(i)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new credit */}
            <div className="space-y-3 pt-1">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Add a credit</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  placeholder="Project / film title"
                  value={newCredit.title}
                  onChange={e => setNewCredit(p => ({ ...p, title: e.target.value }))}
                  className="bg-input border-border text-white sm:col-span-1"
                />
                <Input
                  placeholder="Your role"
                  value={newCredit.role}
                  onChange={e => setNewCredit(p => ({ ...p, role: e.target.value }))}
                  className="bg-input border-border text-white"
                />
                <Input
                  placeholder="Year (optional)"
                  value={newCredit.year}
                  onChange={e => setNewCredit(p => ({ ...p, year: e.target.value }))}
                  className="bg-input border-border text-white"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 border-border/50"
                disabled={!newCredit.title.trim() || !newCredit.role.trim()}
                onClick={addCredit}
              >
                <Plus className="w-4 h-4" /> Add Credit
              </Button>
            </div>
          </div>

          <Button type="submit" disabled={updateMutation.isPending} className="w-full">
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </Form>
    </div>
  );
}
