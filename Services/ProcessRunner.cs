using System.ComponentModel;
using System.Diagnostics;

namespace BlazorStaticMinimalBlog.Services;

public interface IProcessRunner
{
    Task<ProcessResult> RunAsync(string executable, string[] args,
        string? workingDirectory = null,
        Dictionary<string, string?>? environmentVariables = null,
        int timeoutMs = 180_000,
        CancellationToken ct = default);
}

public class ProcessResult
{
    public int ExitCode { get; set; }
    public string StdOut { get; set; } = "";
    public string StdErr { get; set; } = "";
    public bool TimedOut { get; set; }
}

public class SystemProcessRunner : IProcessRunner
{
    public async Task<ProcessResult> RunAsync(string executable, string[] args,
        string? workingDirectory = null,
        Dictionary<string, string?>? environmentVariables = null,
        int timeoutMs = 180_000,
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

        foreach (var a in args)
            psi.ArgumentList.Add(a);

        if (environmentVariables is not null)
        {
            foreach (var kv in environmentVariables)
            {
                if (kv.Value is null)
                    psi.EnvironmentVariables.Remove(kv.Key);
                else
                    psi.EnvironmentVariables[kv.Key] = kv.Value;
            }
        }

        using var process = new Process { StartInfo = psi };
        try
        {
            process.Start();
        }
        catch (Win32Exception ex)
        {
            return new ProcessResult
            {
                ExitCode = -1,
                StdErr = $"Failed to start process: {ex.Message}"
            };
        }

        var readOut = process.StandardOutput.ReadToEndAsync();
        var readErr = process.StandardError.ReadToEndAsync();
        using var timeout = new CancellationTokenSource(timeoutMs);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, timeout.Token);

        try
        {
            await process.WaitForExitAsync(linked.Token);
        }
        catch (OperationCanceledException)
        {
            try
            {
                if (!process.HasExited)
                    process.Kill(entireProcessTree: true);
            }
            catch { /* best effort */ }

            try { await process.WaitForExitAsync(CancellationToken.None); }
            catch { /* best effort */ }

            var stdOut = await readOut;
            var stdErr = await readErr;
            if (ct.IsCancellationRequested)
                throw;

            return new ProcessResult
            {
                ExitCode = -1,
                StdOut = stdOut,
                StdErr = stdErr + $"\n[timed out after {timeoutMs}ms]",
                TimedOut = true
            };
        }

        return new ProcessResult
        {
            ExitCode = process.ExitCode,
            StdOut = await readOut,
            StdErr = await readErr
        };
    }
}
