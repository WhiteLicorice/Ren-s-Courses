using System.Text;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace Ren.Courses.Tests;

/// <summary>
/// Ephemeral markdown post harness. Creates frontmatter-backed markdown
/// entirely in memory — no fixture files on disk. Exists only for the
/// lifetime of the test that creates it.
///
/// Usage:
/// <code>
/// var post = new EphemeralPost(new CourseFrontMatter
/// {
///     Title = "Test",
///     Published = new DateTime(2026, 3, 1),
///     Tags = new List&lt;string&gt; { "cmsc-131" }
/// }, body: "## Hello");
///
/// var fm = post.FrontMatter; // deserialized CourseFrontMatter
/// var md = post.RawMarkdown; // "---\ntitle: Test\n..."
/// var html = post.Body;      // "## Hello"
/// </code>
/// </summary>
public class EphemeralPost<T> where T : class, new()
{
    /// <summary>Raw markdown with YAML frontmatter delimiters.</summary>
    public string RawMarkdown { get; }

    /// <summary>Deserialized frontmatter (read from RawMarkdown).</summary>
    public T FrontMatter { get; }

    /// <summary>Markdown body after the frontmatter block.</summary>
    public string Body { get; }

    /// <summary>
    /// Create an ephemeral post from a frontmatter object and optional body.
    /// Round-trips through YAML serialization/deserialization to match the
    /// BlazorStatic content pipeline.
    /// </summary>
    public EphemeralPost(T frontMatter, string body = "")
    {
        Body = body;

        var serializer = new SerializerBuilder()
            .WithNamingConvention(CamelCaseNamingConvention.Instance)
            .Build();

        var yaml = serializer.Serialize(frontMatter);
        RawMarkdown = $"---\n{yaml}---\n{body}";
        FrontMatter = ParseFrontMatter(RawMarkdown);
    }

    /// <summary>
    /// Create from explicit markdown string. Useful for testing YAML edge
    /// cases (missing fields, malformed data, etc.).
    /// </summary>
    public EphemeralPost(string rawMarkdown)
    {
        RawMarkdown = rawMarkdown;
        FrontMatter = ParseFrontMatter(rawMarkdown);
        Body = ExtractBody(rawMarkdown);
    }

    /// <summary>
    /// Parse YAML frontmatter from markdown string. Expects content between
    /// leading "---" and closing "---" delimiters.
    /// </summary>
    public static T ParseFrontMatter(string markdown)
    {
        const string delimiter = "---";
        using var reader = new StringReader(markdown);

        var firstLine = reader.ReadLine()?.Trim();
        if (firstLine != delimiter)
            throw new InvalidOperationException("Markdown must start with frontmatter delimiter (---).");

        var yaml = new StringBuilder();
        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            if (line.Trim() == delimiter)
                break;
            yaml.AppendLine(line);
        }

        var deserializer = new DeserializerBuilder()
            .WithNamingConvention(CamelCaseNamingConvention.Instance)
            .IgnoreUnmatchedProperties()
            .Build();

        return deserializer.Deserialize<T>(yaml.ToString());
    }

    private static string ExtractBody(string markdown)
    {
        const string delimiter = "---";
        using var reader = new StringReader(markdown);

        // Skip first delimiter
        reader.ReadLine();

        // Skip YAML until closing delimiter
        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            if (line.Trim() == delimiter)
                break;
        }

        // Remaining content is the body
        var body = new StringBuilder();
        while ((line = reader.ReadLine()) != null)
            body.AppendLine(line);

        return body.ToString().TrimEnd();
    }
}
