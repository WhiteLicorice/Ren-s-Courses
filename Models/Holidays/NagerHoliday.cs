namespace BlazorStaticMinimalBlog.Models;

/// <summary>
/// Specific DTO for the Nager.Date API response.
/// Documentation: https://date.nager.at/swagger/index.html
/// </summary>
public class NagerHoliday : Holiday
{

    public string? LocalName { get; set; }
    public string CountryCode { get; set; } = string.Empty;
    public bool Fixed { get; set; }
    public bool Global { get; set; }
    
    // Nager returns null for national holidays, or a list of county codes for regional ones
    public string[]? Counties { get; set; }
    
    public int? LaunchYear { get; set; }
    
    // "Public", "Bank", "School", "Authorities", "Optional", "Observance"
    public string[]? Types { get; set; }
}