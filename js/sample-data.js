/**
 * sample-data.js
 * Pre-populated realistic initial data for demonstration.
 * Stored locally in the browser's localStorage.
 */

// Helper to generate SVG avatar data URLs so members have colorful avatars out of the box
function createSvgAvatar(initials, bgGradientStart, bgGradientEnd) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgGradientStart}" />
        <stop offset="100%" stop-color="${bgGradientEnd}" />
      </linearGradient>
    </defs>
    <rect width="128" height="128" rx="64" fill="url(#grad)" />
    <text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="46" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initials}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const SAMPLE_DATA = {
  version: '2.0',
  currentGroupId: 'group_goa',
  currentUserId: 'member_ashish',
  groups: [
    {
      id: 'group_goa',
      name: 'Goa Beach Vacation 🏖️',
      description: 'Annual college reunion and beach trip expenses',
      currency: '₹',
      createdAt: '2026-10-18T09:00:00.000Z',
      members: [
        {
          id: 'member_ashish',
          name: 'Ashish Kumar',
          email: 'ashish@example.com',
          avatar: createSvgAvatar('AK', '#4F46E5', '#7C3AED'),
          color: '#4F46E5'
        },
        {
          id: 'member_priya',
          name: 'Priya Sharma',
          email: 'priya.s@example.com',
          avatar: createSvgAvatar('PS', '#EC4899', '#F43F5E'),
          color: '#EC4899'
        },
        {
          id: 'member_rahul',
          name: 'Rahul Verma',
          email: 'rahul.v@example.com',
          avatar: createSvgAvatar('RV', '#059669', '#10B981'),
          color: '#10B981'
        },
        {
          id: 'member_sneha',
          name: 'Sneha Patel',
          email: 'sneha.p@example.com',
          avatar: createSvgAvatar('SP', '#D97706', '#F59E0B'),
          color: '#F59E0B'
        }
      ],
      expenses: [
        {
          id: 'exp_1',
          title: 'Luxury Villa Booking (3 Nights)',
          amount: 24000,
          category: 'Accommodation',
          date: '2026-10-19',
          paidBy: 'member_ashish',
          splitType: 'equal',
          splits: {
            'member_ashish': 6000,
            'member_priya': 6000,
            'member_rahul': 6000,
            'member_sneha': 6000
          },
          notes: 'Anjuna private villa with pool'
        },
        {
          id: 'exp_2',
          title: 'Seafood Dinner @ Fisherman\'s Wharf',
          amount: 6800,
          category: 'Food & Dining',
          date: '2026-10-20',
          paidBy: 'member_priya',
          splitType: 'equal',
          splits: {
            'member_ashish': 1700,
            'member_priya': 1700,
            'member_rahul': 1700,
            'member_sneha': 1700
          },
          notes: 'Dinner with live music & mocktails'
        },
        {
          id: 'exp_3',
          title: 'Scooter / Bike Rentals (4 Days)',
          amount: 4800,
          category: 'Transportation',
          date: '2026-10-20',
          paidBy: 'member_rahul',
          splitType: 'equal',
          splits: {
            'member_ashish': 1200,
            'member_priya': 1200,
            'member_rahul': 1200,
            'member_sneha': 1200
          },
          notes: '4 Activa scooters with helmets'
        },
        {
          id: 'exp_4',
          title: 'Water Sports & Scuba Diving',
          amount: 9000,
          category: 'Entertainment',
          date: '2026-10-21',
          paidBy: 'member_ashish',
          splitType: 'exact',
          splits: {
            'member_ashish': 3000,
            'member_priya': 3000,
            'member_sneha': 3000
          },
          notes: 'Rahul skipped scuba due to ear cold'
        },
        {
          id: 'exp_5',
          title: 'Supermarket Groceries & Snacks',
          amount: 3200,
          category: 'Groceries',
          date: '2026-10-22',
          paidBy: 'member_sneha',
          splitType: 'equal',
          splits: {
            'member_ashish': 800,
            'member_priya': 800,
            'member_rahul': 800,
            'member_sneha': 800
          },
          notes: 'Snacks, water cases, breakfast items'
        }
      ],
      settlements: [
        {
          id: 'settle_1',
          fromMemberId: 'member_priya',
          toMemberId: 'member_ashish',
          amount: 3000,
          date: '2026-10-23',
          method: 'UPI',
          notes: 'Google Pay payment towards villa booking'
        }
      ]
    },
    {
      id: 'group_roommates',
      name: 'Flat 402 Roommates 🏠',
      description: 'Monthly flat rent, groceries and utilities',
      currency: '$',
      createdAt: '2026-10-01T12:00:00.000Z',
      members: [
        {
          id: 'member_ashish',
          name: 'Ashish Kumar',
          email: 'ashish@example.com',
          avatar: createSvgAvatar('AK', '#4F46E5', '#7C3AED'),
          color: '#4F46E5'
        },
        {
          id: 'member_david',
          name: 'David Miller',
          email: 'david.m@example.com',
          avatar: createSvgAvatar('DM', '#2563EB', '#38BDF8'),
          color: '#2563EB'
        },
        {
          id: 'member_elena',
          name: 'Elena Rostova',
          email: 'elena.r@example.com',
          avatar: createSvgAvatar('ER', '#9333EA', '#C084FC'),
          color: '#9333EA'
        }
      ],
      expenses: [
        {
          id: 'exp_room_1',
          title: 'High-speed Fiber Internet (Oct)',
          amount: 90,
          category: 'Utilities',
          date: '2026-10-05',
          paidBy: 'member_ashish',
          splitType: 'equal',
          splits: {
            'member_ashish': 30,
            'member_david': 30,
            'member_elena': 30
          },
          notes: '1 Gbps plan'
        },
        {
          id: 'exp_room_2',
          title: 'Costco Wholesale Grocery Haul',
          amount: 240,
          category: 'Groceries',
          date: '2026-10-12',
          paidBy: 'member_david',
          splitType: 'equal',
          splits: {
            'member_ashish': 80,
            'member_david': 80,
            'member_elena': 80
          },
          notes: 'Kitchen staples, cleaning supplies'
        }
      ],
      settlements: []
    }
  ]
};

window.SAMPLE_DATA = SAMPLE_DATA;
window.createSvgAvatar = createSvgAvatar;
