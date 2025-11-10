'use client';

export default function DirectoryTroubleshootingGuide() {
  const issues = [
    {
      title: "Listing doesn't appear in directory",
      checks: [
        "Verify listing is published (not draft)",
        "Check business profile is complete (name, city, state required)",
        "Confirm primary category is selected",
        "Ensure subscription tier includes directory access (not google_only)",
      ],
      solution: "Guide tenant to /t/{tenantId}/settings/directory to complete profile and publish",
    },
    {
      title: "Photos not showing",
      checks: [
        "Check if logo is uploaded in business profile",
        "Verify image URL is accessible",
        "Confirm image format is supported (jpg, png, webp)",
      ],
      solution: "Direct tenant to /t/{tenantId}/settings to upload business logo",
    },
    {
      title: "Wrong category showing",
      checks: [
        "Check primary category in directory settings",
        "Verify category exists in available categories",
      ],
      solution: "Update category in /t/{tenantId}/settings/directory",
    },
    {
      title: "Want to be featured",
      checks: [
        "Confirm subscription tier (Professional+ for featured)",
        "Check if already featured",
        "Verify quality score is adequate",
      ],
      solution: "Explain tier requirements or escalate to admin for manual featuring",
    },
    {
      title: "Quality score is low",
      checks: [
        "Business name present",
        "Address complete",
        "Phone and email added",
        "Logo uploaded",
        "Business hours set",
        "Description written (150+ words recommended)",
        "Categories selected",
        "Products added (10+ recommended)",
      ],
      solution: "Use quality checker to identify missing fields and guide tenant",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Directory Troubleshooting Guide
        </h2>
        
        <div className="space-y-6">
          {issues.map((issue, index) => (
            <div key={index} className="border-l-4 border-blue-500 pl-6 py-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {issue.title}
              </h3>
              
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Check:
                </p>
                <ul className="space-y-1">
                  {issue.checks.map((check, i) => (
                    <li key={i} className="text-sm text-gray-600 dark:text-gray-400">
                      • {check}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <p className="text-sm font-medium text-green-900 dark:text-green-200">
                  Solution:
                </p>
                <p className="text-sm text-green-800 dark:text-green-300 mt-1">
                  {issue.solution}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Reference */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3">
          Quick Reference
        </h3>
        <div className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
          <p><strong>Tenant Settings:</strong> /t/{'{tenantId}'}/settings/directory</p>
          <p><strong>Business Profile:</strong> /t/{'{tenantId}'}/settings</p>
          <p><strong>Public Directory:</strong> /directory</p>
          <p><strong>Minimum Requirements:</strong> Business name, city, state, primary category</p>
          <p><strong>Tier Access:</strong> All tiers except google_only</p>
        </div>
      </div>
    </div>
  );
}
