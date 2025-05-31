using LawyerProject.Application.Common.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LawyerProject.Infrastructure.Services;

public class ChatCleanupService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ChatCleanupService> _logger;

    public ChatCleanupService(
        IServiceProvider serviceProvider,
        ILogger<ChatCleanupService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();


                // Clean up inactive connections (older than 1 hour)
                var inactiveConnections = context.UserConnections
                    .Where(c => !c.IsActive && c.ConnectedAt < DateTime.UtcNow.AddHours(-1))
                    .ToList();

                if (inactiveConnections.Any())
                {
                    context.UserConnections.RemoveRange(inactiveConnections);
                    await context.SaveChangesAsync(stoppingToken);
                    _logger.LogInformation($"Cleaned up {inactiveConnections.Count} inactive connections");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during chat cleanup");
            }

            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }
}
