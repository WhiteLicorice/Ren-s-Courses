namespace BlazorStaticMinimalBlog.Models;

/// <summary>
/// Represents the generic concept of a Holiday used by the application.
/// This decouples the app from specific API implementations.
/// </summary>
public class Holiday
{   
    // For now, we only need Date and Name.
    public DateTime Date { get; set; }
    public string Name { get; set; } = string.Empty;
}