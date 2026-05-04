// Sets environment variables before BuildTimeProvider static ctor runs.
// All test classes using BuildTimeProvider must use this collection.

[CollectionDefinition("BuildTimeProvider")]
public class BuildTimeProviderCollection : ICollectionFixture<TestEnvironmentFixture> { }

public class TestEnvironmentFixture : IDisposable
{
    public TestEnvironmentFixture()
    {
        // Freeze time at 2026-03-15 10:00 UTC → 18:00 PHT
        Environment.SetEnvironmentVariable("STATIC_GEN_TIME", "2026-03-15T10:00:00Z");
        // Term window as PH local dates
        Environment.SetEnvironmentVariable("TERM_START", "2026-01-15");
        Environment.SetEnvironmentVariable("TERM_END", "2026-05-31");
    }

    public void Dispose() { }
}
