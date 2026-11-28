"use client";

// BlogSearchBar
// Part: T4 Blog
// Requirements: BLG-09
// Used by: P-29
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// <BlogSearchBar initial={{ keyword: "pyramids", tag: "egypt" }} />
// Keyword (matches title, tags or author name, BLG-09) and tag filter (BLG-02), the two query
// parameters of GET /api/posts. Search / Clear put them in the URL (/blog?keyword=...&tag=...), so the
// server page (Dynamic SSR) searches again; a new search always starts on page 1.
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { FormField } from "@/components/app/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TAG_MAX_LENGTH, blogHref, type BlogSearch } from "./blog-links";

type BlogSearchBarProps = {
  initial?: BlogSearch;
  /** For tests; defaults to router.push. */
  navigate?: (path: string) => void;
};

export function BlogSearchBar({ initial = {}, navigate }: BlogSearchBarProps) {
  const router = useRouter();
  const go = navigate ?? ((path: string) => router.push(path));
  const [keyword, setKeyword] = useState(initial.keyword ?? "");
  const [tag, setTag] = useState(initial.tag ?? "");
  const active = Boolean(initial.keyword || initial.tag);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    go(blogHref({ keyword: keyword.trim(), tag: tag.trim().replace(/^#/, "") }));
  }

  function clear() {
    setKeyword("");
    setTag("");
    go("/blog");
  }

  return (
    <form role="search" onSubmit={submit} className="grid items-end gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[2fr_1fr_auto]">
      <FormField label="Search posts" name="keyword">
        <Input type="search" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. pyramids" />
      </FormField>
      <FormField label="Tag" name="tag">
        <Input value={tag} maxLength={TAG_MAX_LENGTH} onChange={(e) => setTag(e.target.value)} placeholder="e.g. egypt" />
      </FormField>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1 md:flex-none">
          <SearchIcon /> Search
        </Button>
        {active && (
          <Button type="button" variant="ghost" onClick={clear}>
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}
