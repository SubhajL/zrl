import { collectHighRiskZapAlerts, collectZapAlerts } from './zap-report';

describe('zap-report utilities', () => {
  it('collects alerts and normalizes risk metadata', () => {
    const alerts = collectZapAlerts('frontend', {
      site: [
        {
          alerts: [
            {
              pluginid: 10001,
              name: 'Cookie without secure flag',
              riskcode: '1',
              riskdesc: 'Low (Medium)',
              instances: [{ uri: 'http://example.test' }],
            },
          ],
        },
      ],
    });

    expect(alerts).toEqual([
      {
        pluginId: '10001',
        name: 'Cookie without secure flag',
        riskCode: 1,
        riskDescription: 'Low (Medium)',
        instances: 1,
        source: 'frontend',
      },
    ]);
  });

  it('returns only high-risk alerts for merge blocking', () => {
    const alerts = collectHighRiskZapAlerts('backend', {
      site: [
        {
          alerts: [
            {
              pluginid: '20001',
              name: 'SQL Injection',
              riskcode: '3',
              riskdesc: 'High (High)',
              count: '2',
            },
            {
              pluginid: '20002',
              name: 'Missing cache control',
              riskcode: '1',
              riskdesc: 'Low (Low)',
              count: '5',
            },
          ],
        },
      ],
    });

    expect(alerts).toEqual([
      {
        pluginId: '20001',
        name: 'SQL Injection',
        riskCode: 3,
        riskDescription: 'High (High)',
        instances: 2,
        source: 'backend',
      },
    ]);
  });

  it('handles malformed reports defensively', () => {
    expect(collectZapAlerts('frontend', null)).toEqual([]);
    expect(collectHighRiskZapAlerts('frontend', { site: [{}] })).toEqual([]);
  });
});
