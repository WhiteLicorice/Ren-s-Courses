-- Convert a Markdown-friendly page-break marker to LaTeX.
--
-- Usage (on its own line):
--   <!-- newpage -->

function RawBlock(block)
  if not FORMAT:match("latex") or block.format ~= "html" then
    return nil
  end

  local marker = block.text:lower()
  if marker:match("^<!%-%-%s*newpage%s*%-%->$") then
    return pandoc.RawBlock("latex", "\\newpage")
  end

  return nil
end
