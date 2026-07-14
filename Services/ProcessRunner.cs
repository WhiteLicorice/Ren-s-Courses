using System.Diagnostics;
using System.Text;

namespace BlazorStaticMinimalBlog.Services;

/// <summary>
/// Injectable process runner abstraction for testability.
/// </summary>
public interface IProcessRunner
{
    Task<ProcessResult> RunAsync(string executable, string[] args,
        string? workingDirectory = null,
        Dictionary<string, string?>? environmentVariables = null,
        CancellationToken ct = default);

    Task<ProcessResult> RunWithInputAsync(string executable, string[] args,
        string input,
        string? workingDirectory = null,
        Dictionary<string, string?>? environmentVariables = null,
        CancellationToken ct = default);
}

public class ProcessResult
{
    public int ExitCode { get; set; }
    public string StdOut { get; set; } = "";
    public string StdErr { get; set; } = "";
    public bool TimedOut { get; set; }
}

/// <summary>
/// Real implementation using System.Diagnostics.Process.
/// Always uses ProcessStartInfo.ArgumentList (never shell invocation).
/// Build process args via ArgumentList to avoid shell injection.
/// </summary>
public class SystemProcessRunner : IProcessRunner
{
    private readonly int _timeoutMs;

    public SystemProcessRunner(int timeoutMs = 180_000)
    {
        _timeoutMs = timeoutMs;
    }

    public async Task<ProcessResult> RunAsync(string executable, string[] args,
        string? workingDirectory = null,
        Dictionary<string, string?>? environmentVariables = null,
        CancellationToken ct = default)
    {
        var psi = new ProcessStartInfo
        {
            FileName = executable,
            WorkingDirectory = workingDirectory ?? "",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        foreach (var arg in args)
            psi.ArgumentList.Add(arg);

        if (environmentVariables is not null)
        {
            foreach (var kvp in environmentVariables)
            {
                if (kvp.Value is null)
                    psi.EnvironmentVariables.Remove(kvp.Key);
                else
                    psi.EnvironmentVariables[kvp.Key] = kvp.Value;
            }
        }

        using var process = new Process { StartInfo = psi };
        var outputBuilder = new StringBuilder();
        var errorBuilder = new StringBuilder();

        try
        {
            process.Start();
        }
        catch (System.ComponentModel.Win32Exception ex)
        {
            return new ProcessResult
            {
                ExitCode = -1,
                StdErr = $"Failed to start process: {ex.Message}",
                TimedOut = false
            };
        }

        // Read asynchronously to avoid deadlocks
        var readTask = Task.Run(() =>
        {
            string? line;
            while ((line = process.StandardOutput.ReadLine()) is not null)
                outputBuilder.AppendLine(line);
        }, ct);

        var readErrorTask = Task.Run(() =>
        {
            string? line;
            while ((line = process.StandardError.ReadLine()) is not null)
                errorBuilder.AppendLine(line);
        }, ct);

        var waitTask = process.WaitForExitAsync(ct);
        var completedTask = await Task.WhenAny(waitTask, Task.Delay(_timeoutMs, ct));

        if (completedTask != waitTask)
        {
            try { process.Kill(entireProcessTree: true); } catch { /* best-effort */ }
            return new ProcessResult
            {
                ExitCode = -1,
                StdOut = outputBuilder.ToString(),
                StdErr = errorBuilder.ToString() + "\n[timed out after " + (_timeoutMs / 1000) + "s]",
                TimedOut = true
            };
        }

        await readTask;
        await readErrorTask;

        return new ProcessResult
        {
            ExitCode = process.ExitCode,
            StdOut = outputBuilder.ToString(),
            StdErr = errorBuilder.ToString()
        };
    }

    public async Task<ProcessResult> RunWithInputAsync(string executable, string[] args,
        string input,
        string? workingDirectory = null,
        Dictionary<string, string?>? environmentVariables = null,
        CancellationToken ct = default)
    {
        var psi = new ProcessStartInfo
        {
            FileName = executable,
            WorkingDirectory = workingDirectory ?? "",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            RedirectStandardInput = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        foreach (var arg in args)
            psi.ArgumentList.Add(arg);

        if (environmentVariables is not null)
        {
            foreach (var kvp in environmentVariables)
            {
                if (kvp.Value is null)
                    psi.EnvironmentVariables.Remove(kvp.Key);
                else
                    psi.EnvironmentVariables[kvp.Key] = kvp.Value;
            }
        }

        using var process = new Process { StartInfo = psi };
        var outputBuilder = new StringBuilder();
        var errorBuilder = new StringBuilder();

        try
        {
            process.Start();
        }
        catch (System.ComponentModel.Win32Exception ex)
        {
            return new ProcessResult
            {
                ExitCode = -1,
                StdErr = $"Failed to start process: {ex.Message}",
                TimedOut = false
            };
        }

        await process.StandardInput.WriteAsync(input);
        await process.StandardInput.FlushAsync();
        process.StandardInput.Close();

        var readTask = Task.Run(() =>
        {
            string? line;
            while ((line = process.StandardOutput.ReadLine()) is not null)
                outputBuilder.AppendLine(line);
        }, ct);

        var readErrorTask = Task.Run(() =>
        {
            string? line;
            while ((line = process.StandardError.ReadLine()) is not null)
                errorBuilder.AppendLine(line);
        }, ct);

        var waitTask = process.WaitForExitAsync(ct);
        var completedTask = await Task.WhenAny(waitTask, Task.Delay(_timeoutMs, ct));

        if (completedTask != waitTask)
        {
            try { process.Kill(entireProcessTree: true); } catch { }
            return new ProcessResult
            {
                ExitCode = -1,
                StdOut = outputBuilder.ToString(),
                StdErr = errorBuilder.ToString() + "\n[timed out after " + (_timeoutMs / 1000) + "s]",
                TimedOut = true
            };
        }

        await readTask;
        await readErrorTask;

        return new ProcessResult
        {
            ExitCode = process.ExitCode,
            StdOut = outputBuilder.ToString(),
            StdErr = errorBuilder.ToString()
        };
    }
}
