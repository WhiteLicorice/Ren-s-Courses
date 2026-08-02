-- Shared structural rendering for formal syllabi and ordinary materials.
-- Study schedules use the OBE form's ruled, shaded, repeating-header table.
-- Wide ordinary tables and complete rubric sections use landscape pages.

local function render_blocks(blocks)
  local rendered = pandoc.write(pandoc.Pandoc(blocks), "latex")
  local cleaned = rendered:gsub("%s+$", "")
  return cleaned
end

local function cell_latex(cell)
  local rendered = render_blocks(cell.contents)
  rendered = rendered:gsub(
    "Formative:",
    "\\textbf{Formative:}"
  )
  rendered = rendered:gsub(
    "Summative:",
    "\\textbf{Summative:}"
  )
  rendered = rendered:gsub(
    "(Passing grade[^%.]*%.)",
    "\\emph{%1}"
  )
  rendered = rendered:gsub(
    "(Passing Grade[^%.]*%.)",
    "\\emph{%1}"
  )
  return rendered
end

local function rows_from(table_element)
  local rows = {}
  for _, body in ipairs(table_element.bodies) do
    for _, row in ipairs(body.body) do
      table.insert(rows, row)
    end
  end
  for _, row in ipairs(table_element.foot.rows) do
    table.insert(rows, row)
  end
  return rows
end

local function schedule_table(table_element, title)
  local columns = #table_element.colspecs
  local widths
  if columns == 7 then
    widths = {0.060, 0.085, 0.180, 0.220, 0.070, 0.230, 0.150}
  elseif columns == 6 then
    widths = {0.080, 0.220, 0.230, 0.080, 0.235, 0.145}
  else
    return render_blocks({table_element})
  end

  local specs = {}
  for index, width in ipairs(widths) do
    local alignment = (
      index <= 2 or
      (columns == 7 and index == 5) or
      (columns == 6 and index == 4)
    ) and "\\centering\\arraybackslash" or "\\raggedright\\arraybackslash"
    table.insert(
      specs,
      string.format(
        ">{%s}p{\\dimexpr %.3f\\linewidth-2\\tabcolsep\\relax}",
        alignment,
        width
      )
    )
  end

  local header_cells = table_element.head.rows[1].cells
  local header = {}
  for _, cell in ipairs(header_cells) do
    table.insert(
      header,
      "{\\centering\\bfseries " .. cell_latex(cell) .. "\\par}"
    )
  end
  local header_row = table.concat(header, " & ")
  local page_header = string.format(
    "\\multicolumn{%d}{@{}l@{}}{\\makebox[\\linewidth]{"
      .. "\\scriptsize\\color{upgray}\\thepage\\ \\textbar{} Page"
      .. "\\hfill\\RunningHeaderText}} \\\\",
    columns
  )
  local page_rule = string.format(
    "\\multicolumn{%d}{@{}l@{}}{\\color{black!50}"
      .. "\\rule{\\linewidth}{0.25pt}} \\\\[0.8ex]",
    columns
  )
  local table_title = nil
  if title ~= nil and title ~= "" then
    table_title = string.format(
      "\\multicolumn{%d}{@{}l@{}}{\\normalsize\\bfseries %s}"
        .. " \\\\[1.0ex]",
      columns,
      title
    )
  end
  local green_bar = string.format(
    "\\multicolumn{%d}{@{}l@{}}{\\makebox[0pt][l]{\\hspace{-0.60in}"
      .. "\\color{upgreen}\\rule{297mm}{0.055in}}} \\\\[-0.8ex]",
    columns
  )
  local maroon_bar = string.format(
    "\\multicolumn{%d}{@{}l@{}}{\\makebox[0pt][l]{\\hspace{-0.60in}"
      .. "\\color{upmaroon}\\rule{297mm}{0.26in}}} \\\\",
    columns
  )

  local output = {
    "\\begingroup",
    "\\small",
    "\\setlength{\\tabcolsep}{4pt}",
    "\\renewcommand{\\arraystretch}{1.20}",
    "\\arrayrulecolor{black!28}",
    "\\begin{longtable}{|" .. table.concat(specs, "|") .. "|}",
    page_header,
    page_rule,
  }
  if table_title ~= nil then
    table.insert(output, table_title)
  end
  table.insert(output, "\\hline")
  table.insert(
    output,
    "\\rowcolor{tablegray}[\\tabcolsep]"
      .. "[\\dimexpr2\\tabcolsep\\relax]\\rule{0pt}{3.6ex}"
      .. header_row .. " \\\\[0.8ex]"
  )
  table.insert(output, "\\hline")
  table.insert(output, "\\endfirsthead")
  table.insert(output, "\\noalign{\\vspace{0.42in}}")
  table.insert(output, page_header)
  table.insert(output, page_rule)
  table.insert(output, "\\hline")
  table.insert(
    output,
    "\\rowcolor{tablegray}[\\tabcolsep]"
      .. "[\\dimexpr2\\tabcolsep\\relax]\\rule{0pt}{3.6ex}"
      .. header_row .. " \\\\[0.8ex]"
  )
  table.insert(output, "\\hline")
  table.insert(output, "\\endhead")
  table.insert(output, "\\hline")
  table.insert(output, green_bar)
  table.insert(output, maroon_bar)
  table.insert(output, "\\endfoot")
  table.insert(output, "\\hline")
  table.insert(output, green_bar)
  table.insert(output, maroon_bar)
  table.insert(output, "\\endlastfoot")

  for _, row in ipairs(rows_from(table_element)) do
    local cells = {}
    for _, cell in ipairs(row.cells) do
      table.insert(cells, cell_latex(cell))
    end
    table.insert(output, table.concat(cells, " & ") .. " \\\\[0.9ex]")
    table.insert(output, "\\hline")
  end

  table.insert(output, "\\end{longtable}")
  table.insert(output, "\\endgroup")
  return table.concat(output, "\n")
end

local function has_class(div, expected)
  for _, class in ipairs(div.classes) do
    if class == expected then
      return true
    end
  end
  return false
end

local function is_rubric_header(block)
  if block.t ~= "Header" then
    return false
  end
  local text = pandoc.utils.stringify(block.content):lower()
  return text:find("rubric", 1, true) ~= nil
end

local function landscape_table(table_element, title)
  return {
    pandoc.RawBlock("latex", "\\SyllabusLandscapeBegin"),
    pandoc.RawBlock("latex", schedule_table(table_element, title)),
    pandoc.RawBlock("latex", "\\SyllabusLandscapeEnd"),
  }
end

local function landscape_rubric(blocks)
  return {
    pandoc.RawBlock(
      "latex",
      "\\SyllabusLandscapeBegin\n\\LandscapeContentHeader\n\\begingroup\n\\small"
    ),
    pandoc.RawBlock("latex", render_blocks(blocks)),
    pandoc.RawBlock(
      "latex",
      "\\endgroup\n\\SyllabusLandscapeEnd"
    ),
  }
end

local function transform_blocks(blocks, auto_wide_tables)
  local output = {}
  local index = 1
  while index <= #blocks do
    local block = blocks[index]
    if is_rubric_header(block) then
      local rubric_level = block.level
      local rubric_blocks = {block}
      index = index + 1
      while index <= #blocks do
        local candidate = blocks[index]
        if (
          candidate.t == "Header"
          and candidate.level <= rubric_level
        ) then
          break
        end
        table.insert(rubric_blocks, candidate)
        index = index + 1
      end
      for _, replacement in ipairs(landscape_rubric(rubric_blocks)) do
        table.insert(output, replacement)
      end
    elseif block.t == "Div" and has_class(block, "landscape") then
      local title = nil
      for _, child in ipairs(block.content) do
        if child.t == "Header" and title == nil then
          title = render_blocks({pandoc.Plain(child.content)})
        elseif child.t == "Table" then
          for _, replacement in ipairs(landscape_table(child, title)) do
            table.insert(output, replacement)
          end
          title = nil
        else
          table.insert(output, child)
        end
      end
      index = index + 1
    elseif (
      block.t == "Table"
      and auto_wide_tables
      and #block.colspecs >= 6
    ) then
      for _, replacement in ipairs(landscape_table(block, nil)) do
        table.insert(output, replacement)
      end
      index = index + 1
    elseif block.t == "Div" then
      block.content = transform_blocks(block.content, auto_wide_tables)
      table.insert(output, block)
      index = index + 1
    else
      table.insert(output, block)
      index = index + 1
    end
  end
  return output
end

function Pandoc(document)
  if FORMAT:match("latex") then
    local pdf = document.meta.pdf
    local variables = pdf ~= nil and pdf.variables or nil
    local is_formal_syllabus = (
      variables ~= nil and variables.academicTerm ~= nil
    )
    document.blocks = transform_blocks(
      document.blocks,
      not is_formal_syllabus
    )
  end
  return document
end
