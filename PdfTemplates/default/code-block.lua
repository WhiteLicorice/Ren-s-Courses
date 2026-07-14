-- Pandoc Lua filter: ensure all code blocks use Highlighting environment.
-- Unlabeled fenced code blocks (``` with no language) get routed to
-- LaTeX's bare \begin{verbatim} by default, skipping the template's
-- \RecustomVerbatimEnvironment{Highlighting}{...} styling (frame, line
-- numbers, gray background).  Giving them a dummy class forces Pandoc
-- through Highlighting, where the template styling applies uniformly.
-- Much wow!
function CodeBlock(block)
  if #block.classes == 0 then
    block.classes = {'text'}
  end
  return block
end
