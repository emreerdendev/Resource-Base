import { NotFoundView } from "@/components/not-found-view";

/** 404 for pages inside the site (unknown slugs, …); the layout adds the chrome. */
export default function NotFound() {
  return <NotFoundView />;
}
