import { Globe } from "lucide-react";
import {
  CodepenIcon,
  DribbbleIcon,
  GithubIcon,
  GitlabMonoIcon,
  InstagramIcon,
  LinkedinIcon,
  XIcon,
} from "@/components/brand-icons";
import type { SocialPlatformId } from "@/lib/social-links";

/** Icon per profile link platform (see lib/social-links.ts). */
export const SOCIAL_ICONS: Record<SocialPlatformId, React.ComponentType<{ className?: string }>> = {
  website: Globe,
  linkedin: LinkedinIcon,
  github: GithubIcon,
  gitlab: GitlabMonoIcon,
  codepen: CodepenIcon,
  x: XIcon,
  instagram: InstagramIcon,
  dribbble: DribbbleIcon,
};
