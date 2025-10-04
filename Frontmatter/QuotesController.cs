using System.ComponentModel.DataAnnotations;

class QuotesController
{
    private static Quotation[] quotes = QuoteCollection.Quotes;
    public static Quotation GetRandomQuote()
    {
        var random = new Random();
        return quotes[random.Next(quotes.Length)];
    }

    public static String GetHomeQuote()
    {
        var quote = GetRandomQuote();
        return new String($"{quote.quote} — {quote.author}");
    }
}