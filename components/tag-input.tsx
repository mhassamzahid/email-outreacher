"use client"

import { useState, type KeyboardEvent } from "react"
import { X } from "lucide-react"

export function TagInput({
  id,
  value,
  onChange,
  placeholder,
  places = false,
}: {
  id?: string
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  /** Places keep their commas ("Chicago, IL" is one place): only Enter or ";" separates them. */
  places?: boolean
}) {
  const [text, setText] = useState("")
  const separator = places ? ";" : ","

  const commit = () => {
    const parts = text
      .split(separator)
      .map((t) => t.trim())
      .filter((t) => t && !value.includes(t))
    if (parts.length) onChange([...value, ...parts])
    setText("")
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === separator) {
      e.preventDefault()
      commit()
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input px-1.5 py-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-xs">
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onChange(value.filter((t) => t !== tag))}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={value.length ? "" : placeholder}
        className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}
