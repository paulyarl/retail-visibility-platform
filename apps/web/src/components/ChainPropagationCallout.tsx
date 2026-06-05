'use client';

import { motion } from 'framer-motion';

const propagationTypes = [
  {
    icon: '📦',
    title: 'Products/SKUs',
    status: 'ACTIVE',
    statusColor: 'bg-green-100 text-green-800',
    bgColor: 'bg-blue-100',
    description: 'Sync all products from hero location to all other locations with one click',
    benefits: [
      'Bulk sync from hero location',
      'Individual product propagation',
      'Saves 400+ hours per rollout',
    ],
  },
  {
    icon: '📂',
    title: 'Categories',
    status: 'ACTIVE',
    statusColor: 'bg-green-100 text-green-800',
    bgColor: 'bg-purple-100',
    description: 'Propagate product categories and Google taxonomy alignments across all locations',
    benefits: [
      'Google Product Taxonomy sync',
      'Consistent categorization',
      'Perfect for chain-wide updates',
    ],
  },
  {
    icon: '🔄',
    title: 'GBP Category Sync',
    status: 'ACTIVE',
    statusColor: 'bg-green-100 text-green-800',
    bgColor: 'bg-indigo-100',
    description: 'Sync product categories to Google Business Profile with strategic testing',
    benefits: [
      'Test on 1 location first',
      'Sync to all with one click',
      'Strategic rollout capability',
    ],
  },
  {
    icon: '🕐',
    title: 'Business Hours',
    status: 'COMING SOON',
    statusColor: 'bg-blue-100 text-blue-800',
    bgColor: 'bg-green-100',
    description: 'Propagate regular and special hours to maintain consistent schedules',
    benefits: [
      'Regular hours sync',
      'Special hours (holidays)',
      'Timezone-aware',
    ],
  },
  {
    icon: '🏪',
    title: 'Business Profile',
    status: 'COMING SOON',
    statusColor: 'bg-blue-100 text-blue-800',
    bgColor: 'bg-cyan-100',
    description: 'Sync business description, attributes, and settings across all locations',
    benefits: [
      'Business description',
      'Attributes & amenities',
      'Contact information',
    ],
  },
  {
    icon: '🚩',
    title: 'Feature Flags',
    status: 'COMING SOON',
    statusColor: 'bg-blue-100 text-blue-800',
    bgColor: 'bg-indigo-100',
    description: 'Enable or disable features across all locations from one centralized place',
    benefits: [
      'Centralized control',
      'Instant enable/disable',
      'Perfect for A/B testing',
    ],
  },
  {
    icon: '👥',
    title: 'User Roles',
    status: 'COMING SOON',
    statusColor: 'bg-blue-100 text-blue-800',
    bgColor: 'bg-pink-100',
    description: 'Propagate user invitations and role assignments for team management',
    benefits: [
      'Bulk user invitations',
      'Role assignment sync',
      'Permission management',
    ],
  },
  {
    icon: '🎨',
    title: 'Brand Assets',
    status: 'COMING SOON',
    statusColor: 'bg-blue-100 text-blue-800',
    bgColor: 'bg-orange-100',
    description: 'Propagate logos, colors, and branding elements for perfect consistency',
    benefits: [
      'Logo distribution',
      'Color scheme sync',
      'Brand consistency',
    ],
  },
];

export default function ChainPropagationCallout() {
  return (
    <section className="py-16 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-block bg-yellow-400 text-emerald-900 text-sm px-4 py-2 rounded-full font-bold mb-4">
            🏢 ENTERPRISE CHAIN MANAGEMENT
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            8 Propagation Types - Complete Chain Control
          </h2>
          <p className="text-xl text-emerald-100 max-w-3xl mx-auto mb-2">
            Manage your entire franchise or multi-location chain from <strong className="text-yellow-300">one centralized dashboard</strong>
          </p>
          <p className="text-lg text-emerald-200 max-w-3xl mx-auto">
            Test on 1 location before rolling out to all. This is what enterprise retailers pay <strong className="text-yellow-300">$50K+/year</strong> for.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {propagationTypes.map((type, index) => (
            <motion.div
              key={type.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl p-6 shadow-xl hover:shadow-2xl transition-shadow"
            >
              <div className="text-center mb-4">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${type.bgColor} mb-3`}>
                  <span className="text-3xl">{type.icon}</span>
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-1">{type.title}</h3>
                <div className={`inline-block ${type.statusColor} text-xs px-2 py-1 rounded-full font-semibold`}>
                  {type.status}
                </div>
              </div>
              <p className="text-sm text-neutral-600 mb-3">
                {type.description}
              </p>
              <ul className="space-y-1 text-xs text-neutral-700">
                {type.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start">
                    <svg className="w-3 h-3 text-green-600 mr-1 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {benefit}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Value Proposition */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center"
        >
          <h3 className="text-2xl font-bold text-white mb-4">
            💰 This is What Enterprise Retailers Pay $50K+/Year For
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <div className="text-4xl font-bold text-yellow-300 mb-2">400+</div>
              <div className="text-emerald-100">Hours Saved Per Rollout</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-yellow-300 mb-2">8</div>
              <div className="text-emerald-100">Propagation Types</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-yellow-300 mb-2">1-Click</div>
              <div className="text-emerald-100">Chain-Wide Distribution</div>
            </div>
          </div>
          <p className="text-emerald-100 max-w-2xl mx-auto">
            Perfect consistency across all locations. Test on one location before rolling out to 50+. 
            This level of control is what separates successful chains from inconsistent ones.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
