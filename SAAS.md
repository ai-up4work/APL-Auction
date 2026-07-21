# Valiant League SaaS Implementation

Complete SaaS transformation of the Valiant League application with multi-tenant architecture, authentication, authorization, and tournament management.

## Architecture Overview

### Database Schema (`supabase/migrations/001_create_saas_schema.sql`)

**Core Tables:**
- `organizations` - Organization containers
- `user_profiles` - Extended user information
- `org_memberships` - User-organization relationships with roles
- `auctions` - Auction events (org-scoped)
- `players` - Player data (org-scoped)
- `tournaments` - Tournament containers (org-scoped)
- `teams` - Teams in auctions and tournaments
- `matches` - Match fixtures
- `match_scorecards` - Match scoring data

**Key Features:**
- Row Level Security (RLS) policies enforce org isolation
- Automatic timestamp updates via triggers
- Comprehensive indexes for performance
- Foreign key constraints for data integrity

## Authentication & Authorization

### Types (`types/saas.ts`)
```
- Organization types (roles, plans, status)
- User types with org context
- API response types
- Membership types
```

### Auth Library (`lib/auth.ts`)
- `getCurrentUser()` - Get authenticated user with org context
- `signUp()` - Create new user account
- `signIn()` - Login user
- `signOut()` - Logout user
- `resetPassword()` - Initiate password reset
- `updatePassword()` - Change password
- `updateUserProfile()` - Update user information
- `setCurrentOrganization()` - Switch active org

### Organizations Library (`lib/organizations.ts`)
- `createOrganization()` - Create new org
- `getOrganization()` - Retrieve org by ID
- `getOrganizationBySlug()` - Retrieve org by slug
- `updateOrganization()` - Update org details
- `getOrgMembers()` - List org members
- `inviteToOrganization()` - Invite users
- `updateMemberRole()` - Change member roles
- `removeMember()` - Remove member from org
- `checkOrgPermission()` - Verify user permission level
- `getUserRoleInOrg()` - Get user's role in org

## API Routes

### Auth Endpoint (`app/api/auth/route.ts`)
**Actions:**
- `signup` - User registration
- `signin` - User login (sets secure cookies)
- `signout` - User logout (clears cookies)
- `get-user` - Fetch current user
- `reset-password` - Password reset request

### Organization Endpoint (`app/api/org/route.ts`)
**Actions:**
- `create` - Create organization
- `get` - Retrieve organization
- `update` - Update organization (admin only)
- `get-members` - List members
- `invite-member` - Invite user (admin only)
- `update-member-role` - Change role (admin only)
- `remove-member` - Remove member (admin only)
- `set-current-org` - Switch active organization

### Tournaments Endpoint (`app/api/tournaments/route.ts`)
**Actions:**
- `create` - Create tournament (manager+)
- `list` - List org tournaments
- `get` - Retrieve tournament
- `update` - Update tournament (manager+)
- `add-teams` - Add teams to tournament (manager+)
- `get-teams` - List tournament teams
- `generate-matches` - Create bracket matches (manager+)
- `get-matches` - List matches
- `update-match` - Record match result

## Middleware (`middleware.ts`)

**Features:**
- Route protection (auth required for protected routes)
- Automatic redirect to login for unauthenticated users
- Redirect authenticated users away from auth pages
- Security headers (XSS protection, CSRF prevention, etc.)
- Cookie-based session management

**Protected Routes:**
- `/dashboard/*`
- `/org/*`
- `/auctions/*`
- `/tournaments/*`
- `/settings/*`
- `/api/org*`
- `/api/auctions*`
- `/api/tournaments*`

## UI Components

### Authentication Components

#### SignUpForm (`components/auth/SignUpForm.tsx`)
- Full name, email, password fields
- Password confirmation validation
- API integration with error handling
- Auto-redirect to login on success

#### SignInForm (`components/auth/SignInForm.tsx`)
- Email and password fields
- Forgot password link
- Signup redirect
- Session management with cookies

### Pages

#### Login (`app/auth/login/page.tsx`)
- Branded login interface
- Beautiful dark mode design
- Mobile responsive

#### Signup (`app/auth/signup/page.tsx`)
- Account creation flow
- Consistent branding
- Mobile optimized

#### Dashboard (`app/dashboard/page.tsx`)
- Current organization overview
- Quick action cards
- Organization switcher
- Team member count
- Sign out button
- Create organization flow

#### Tournaments (`app/org/[orgId]/tournaments/page.tsx`)
- List all tournaments
- Create tournament modal
- Edit/delete options
- Format display (single/double elimination)
- Status indicators

## Role-Based Access Control

**Roles:**
- `admin` - Full organization access, manage members, create events
- `manager` - Can create auctions/tournaments, manage teams
- `viewer` - Read-only access to org data

**Permission Model:**
- All database queries filtered by org_id
- RLS policies enforce at database level
- API routes verify permissions before operations
- Hierarchical role checking (viewer < manager < admin)

## Data Flow

```
User (Client)
    ↓
Middleware (auth check)
    ↓
Page/API Route
    ↓
Auth Library (getCurrentUser)
    ↓
Organization Library (checkOrgPermission)
    ↓
Database (RLS policies enforce access)
```

## Multi-Tenant Isolation

**Enforcement at Multiple Levels:**

1. **Database Level:** RLS policies ensure queries can only access user's orgs
2. **API Level:** Permission checks before any operation
3. **Middleware Level:** Route protection for authenticated endpoints
4. **Application Level:** URL params include org_id, validated against user's orgs

## Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Database Schema SQL

Full schema available in: `supabase/migrations/001_create_saas_schema.sql`

Run this migration in Supabase to create all tables, indexes, RLS policies, and triggers.

## Tournament Management

### Libraries (`lib/tournaments.ts`)
- `createTournament()` - New tournament
- `getTournament()` - Retrieve tournament
- `getOrgTournaments()` - List org tournaments
- `updateTournament()` - Update tournament
- `addTeamsToTournament()` - Add teams
- `getTournamentTeams()` - List teams
- `generateMatches()` - Create bracket
- `getTournamentMatches()` - List matches
- `updateMatchResult()` - Record result

### Features
- Single & double elimination support
- Automatic bracket generation
- Match scheduling
- Result recording
- Team management
- Seed positioning

## Security Features

- **Password Hashing:** Supabase handles bcrypt hashing
- **Session Management:** HttpOnly cookies for tokens
- **CORS Protection:** Proper origin validation
- **SQL Injection Prevention:** Parameterized queries
- **XSS Protection:** Security headers
- **CSRF Protection:** SameSite cookie policy
- **Input Validation:** Type checking and sanitization

## Next Steps for Production

1. **Email Notifications:**
   - Invitation emails
   - Password reset emails
   - Event notifications

2. **Stripe Integration:**
   - Billing plans
   - Subscription management
   - Usage tracking

3. **File Uploads:**
   - Team logos
   - Player photos
   - Organization branding

4. **Real-time Features:**
   - Live match updates
   - Auction bidding (Supabase Realtime)
   - Team notifications

5. **Analytics:**
   - Event metrics
   - User engagement
   - Revenue tracking

6. **Admin Dashboard:**
   - System administration
   - User management
   - Organization oversight

## Testing

Create test users in Supabase Auth and test:

1. Signup/Login flow
2. Organization creation
3. Member invitations
4. Tournament creation
5. Permission enforcement
6. Cross-org isolation

## Deployment

1. Push migration to Supabase
2. Deploy to Vercel
3. Set environment variables
4. Test all flows in production
5. Monitor auth and API endpoints

## File Structure

```
app/
├── api/
│   ├── auth/route.ts              # Auth endpoints
│   ├── org/route.ts               # Org management
│   └── tournaments/route.ts       # Tournament management
├── auth/
│   ├── login/page.tsx             # Login page
│   └── signup/page.tsx            # Signup page
├── dashboard/
│   └── page.tsx                   # Main dashboard
└── org/[orgId]/
    └── tournaments/
        └── page.tsx               # Tournament listing

components/
└── auth/
    ├── SignInForm.tsx             # Login form
    └── SignUpForm.tsx             # Signup form

lib/
├── auth.ts                        # Auth functions
├── organizations.ts               # Org functions
├── tournaments.ts                 # Tournament functions
└── supabse.ts                     # Supabase client

types/
└── saas.ts                        # TypeScript types

middleware.ts                      # Route protection
supabase/
└── migrations/
    └── 001_create_saas_schema.sql # Database schema
```

## Support

For questions or issues, refer to:
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
- TypeScript Docs: https://www.typescriptlang.org/docs
