namespace BlazorStaticMinimalBlog.Models;

public class LearningDiagram
{
    public string Title { get; set; } = "Untitled diagram";
    public string Key { get; set; } = "";
    public string Description { get; set; } = "";
    public List<LearningDiagramStep> Steps { get; set; } = new();
}
