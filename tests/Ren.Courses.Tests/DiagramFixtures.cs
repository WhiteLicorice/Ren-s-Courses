using BlazorStatic;
using BlazorStaticMinimalBlog.Models;
using RensMarkdownTemplates.Models;

namespace Ren.Courses.Tests;

/// <summary>
/// Permanent, in-memory interactive-diagram fixtures for the .NET suite.
///
/// Every fixture round-trips its frontmatter through
/// <see cref="EphemeralPost{T}"/>, so a test sees exactly the YAML contract an
/// authored material would produce. No fixture touches Content/Materials, and
/// no production article acts as test infrastructure.
///
/// The fixture names match tests/fixtures/diagram-fixtures.js, which carries
/// the same matrix for the Jest and Playwright suites.
/// </summary>
public static class DiagramFixtures
{
    /// <summary>Wide left-to-right token stream that opts in to a vertical narrow layout.</summary>
    public static LearningDiagram WideTokenStream(string key = "token-stream") => new()
    {
        Key = key,
        Title = "Token stream for a = 1 + 2;",
        Description = "The scanner emits one token per source lexeme.",
        NarrowDirection = "TB",
        Steps =
        [
            TokenStreamStep("Scan the identifier", "The scanner reads the assignment target.", "T0"),
            TokenStreamStep("Scan the assignment operator", "The equals sign separates target from expression.", "T1"),
            TokenStreamStep("Scan the first operand", "The first integer literal enters the stream.", "T2"),
            TokenStreamStep("Scan the addition operator", "The operator joins both integer literals.", "T3")
        ]
    };

    /// <summary>Equally wide, but the author approved no vertical variant.</summary>
    public static LearningDiagram WideFlowchartWithoutReflow(string key = "compiler-phases") => new()
    {
        Key = key,
        Title = "Compiler phases",
        Description = "Each phase hands its output to the next phase.",
        Steps =
        [
            CompilerPhaseStep("Front end", "Source text becomes an annotated tree.", "P0"),
            CompilerPhaseStep("Back end", "The tree becomes machine instructions.", "P5")
        ]
    };

    /// <summary>A sequence diagram that declares a narrow direction it cannot use.</summary>
    public static LearningDiagram WideSequenceDiagram(string key = "factorial-recursion") => new()
    {
        Key = key,
        Title = "Evaluating factorial(3)",
        Description = "Each call waits for the next smaller factorial.",
        NarrowDirection = "TB",
        Steps =
        [
            new()
            {
                Title = "Descend into the recursion",
                Description = "Every call suspends until its callee returns.",
                Mermaid = string.Join('\n',
                    "sequenceDiagram",
                    "    participant M as main routine",
                    "    participant F3 as factorial(3)",
                    "    participant F2 as factorial(2)",
                    "    M->>F3: factorial(3)",
                    "    F3->>F2: factorial(2)")
            },
            new()
            {
                Title = "Unwind the call stack",
                Description = "Each frame multiplies and returns.",
                Mermaid = string.Join('\n',
                    "sequenceDiagram",
                    "    participant M as main routine",
                    "    participant F3 as factorial(3)",
                    "    participant F2 as factorial(2)",
                    "    F2-->>F3: 2",
                    "    F3-->>M: 6")
            }
        ]
    };

    /// <summary>Steps with different drawing sizes, title lengths and description lengths.</summary>
    public static LearningDiagram MixedAspectSteps(string key = "mixed-aspect") => new()
    {
        Key = key,
        Title = "Mixed aspect walkthrough",
        Description = "Step geometry changes on every step.",
        Steps =
        [
            new()
            {
                Title = "Wide and short",
                Description = "One short line.",
                Mermaid = "flowchart LR\n    A[\"Alpha\"] --> B[\"Beta\"]\n    B --> C[\"Gamma\"]\n    C --> D[\"Delta\"]"
            },
            new()
            {
                Title = "Narrow and tall",
                Description = "A much longer description that wraps onto more than one line so the "
                    + "complete step area is taller than the previous step and the widget must not "
                    + "resize when the reader moves between the two.",
                Mermaid = "flowchart TB\n    A[\"Alpha\"] --> B[\"Beta\"]\n    B --> C[\"Gamma\"]\n    C --> D[\"Delta\"]\n    D --> E[\"Epsilon\"]"
            },
            new()
            {
                Title = "Square",
                Mermaid = "flowchart TB\n    A[\"Alpha\"] --> B[\"Beta\"]\n    A --> C[\"Gamma\"]"
            }
        ]
    };

    /// <summary>Already vertical and small, so the canonical source always fits.</summary>
    public static LearningDiagram AlreadyVerticalFlowchart(string key = "two-phase-commit") => new()
    {
        Key = key,
        Title = "Two phase commit",
        Description = "A short vertical flow.",
        NarrowDirection = "TB",
        Steps =
        [
            new() { Title = "Prepare", Description = "Ask every participant.", Mermaid = "flowchart TB\n    A[\"Prepare\"] --> B[\"Vote\"]" },
            new() { Title = "Commit", Description = "Apply the decision.", Mermaid = "flowchart TB\n    A[\"Prepare\"] --> B[\"Commit\"]" }
        ]
    };

    /// <summary>One step only, so playback stays disabled.</summary>
    public static LearningDiagram SingleStepDiagram(string key = "single-frame") => new()
    {
        Key = key,
        Title = "Single frame",
        Description = "Nothing to step through.",
        Steps =
        [
            new() { Title = "The only step", Description = "One frame.", Mermaid = "flowchart LR\n    A[\"Only\"] --> B[\"Frame\"]" }
        ]
    };

    /// <summary>
    /// Build a rendered post from diagrams plus the body HTML that references
    /// them. The frontmatter round-trips through YAML, so the returned post
    /// carries exactly what the content pipeline would deserialize.
    /// </summary>
    public static Post<CourseFrontMatter> BuildPost(
        string url,
        string htmlContent,
        params LearningDiagram[] diagrams)
    {
        var ephemeral = new EphemeralPost<CourseFrontMatter>(new CourseFrontMatter
        {
            Title = "Diagram fixture",
            Published = new DateTime(2026, 3, 1),
            Diagrams = [.. diagrams]
        });

        return new Post<CourseFrontMatter>
        {
            Url = url,
            HtmlContent = htmlContent,
            FrontMatter = ephemeral.FrontMatter
        };
    }

    /// <summary>Body HTML that references each diagram key once, in order.</summary>
    public static string MarkersFor(params LearningDiagram[] diagrams) =>
        string.Join("\n", diagrams.Select(diagram => $"<!-- diagram: {diagram.Key} -->"));

    private static LearningDiagramStep TokenStreamStep(string title, string description, string active) => new()
    {
        Title = title,
        Description = description,
        Mermaid = string.Join('\n',
            "flowchart LR",
            "    T0[\"IDENT: identifier a\"] --> T1[\"ASSIGN: equals sign\"]",
            "    T1 --> T2[\"NUMBER: integer literal 1\"]",
            "    T2 --> T3[\"PLUS: addition operator\"]",
            "    T3 --> T4[\"NUMBER: integer literal 2\"]",
            "    T4 --> T5[\"SEMI: statement terminator\"]",
            "    T5 --> T6[\"EOF: end of source input\"]",
            "    T6 --> T7[\"ACCEPT: token stream complete\"]",
            "    classDef active fill:#ef4444,color:#ffffff,stroke:#991b1b,stroke-width:2px",
            $"    class {active} active")
    };

    private static LearningDiagramStep CompilerPhaseStep(string title, string description, string active) => new()
    {
        Title = title,
        Description = description,
        Mermaid = string.Join('\n',
            "flowchart LR",
            "    P0[\"Lexical analysis\"] --> P1[\"Syntax analysis\"]",
            "    P1 --> P2[\"Semantic analysis\"]",
            "    P2 --> P3[\"Intermediate representation\"]",
            "    P3 --> P4[\"Machine independent optimizer\"]",
            "    P4 --> P5[\"Instruction selection\"]",
            "    P5 --> P6[\"Register allocation\"]",
            "    P6 --> P7[\"Object code emission\"]",
            "    classDef active fill:#ef4444,color:#ffffff,stroke:#991b1b,stroke-width:2px",
            $"    class {active} active")
    };
}
