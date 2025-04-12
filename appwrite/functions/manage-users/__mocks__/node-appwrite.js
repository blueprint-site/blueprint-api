// __mocks__/node-appwrite.js
export const Client = jest.fn().mockImplementation(() => {
  return {
    setEndpoint: jest.fn().mockReturnThis(),
    setProject: jest.fn().mockReturnThis(),
    setKey: jest.fn().mockReturnThis(),
  };
});

export const Users = jest.fn().mockImplementation(() => {
  return {
    list: jest.fn().mockResolvedValue({
      total: 2,
      users: [
        {
          $id: 'user1',
          $createdAt: '2023-01-15T06:38:00.000+00:00',
          $updatedAt: '2023-01-15T06:38:00.000+00:00',
          name: 'Test User 1',
          email: 'user1@example.com',
          status: true,
          emailVerification: true,
          phoneVerification: false,
          labels: ['developer'],
        },
        {
          $id: 'user2',
          $createdAt: '2023-01-16T09:42:00.000+00:00',
          $updatedAt: '2023-01-16T09:42:00.000+00:00',
          name: 'Test User 2',
          email: 'user2@example.com',
          status: true,
          emailVerification: true,
          phoneVerification: false,
          labels: ['tester'],
        },
      ],
    }),

    listMemberships: jest.fn().mockResolvedValue({
      total: 2,
      memberships: [
        {
          $id: 'membership1',
          $createdAt: '2023-01-15T06:38:00.000+00:00',
          $updatedAt: '2023-01-15T06:38:00.000+00:00',
          userId: 'user1',
          userName: 'Test User 1',
          userEmail: 'user1@example.com',
          teamId: 'team1',
          teamName: 'Developers',
          invited: '2023-01-15T06:38:00.000+00:00',
          joined: '2023-01-15T06:38:00.000+00:00',
          confirm: false,
          roles: ['developer'],
        },
        {
          $id: 'membership2',
          $createdAt: '2023-01-15T06:40:00.000+00:00',
          $updatedAt: '2023-01-15T06:40:00.000+00:00',
          userId: 'user1',
          userName: 'Test User 1',
          userEmail: 'user1@example.com',
          teamId: 'adminTeamId',
          teamName: 'Administrators',
          invited: '2023-01-15T06:40:00.000+00:00',
          joined: '2023-01-15T06:40:00.000+00:00',
          confirm: false,
          roles: ['owner'],
        },
      ],
    }),
  };
});

export const Teams = jest.fn().mockImplementation(() => {
  return {
    createMembership: jest.fn().mockResolvedValue({
      $id: 'new-membership-id',
      $createdAt: '2023-01-20T12:00:00.000+00:00',
      $updatedAt: '2023-01-20T12:00:00.000+00:00',
      userId: 'user1',
      userName: 'Test User 1',
      userEmail: 'user1@example.com',
      teamId: 'team1',
      teamName: 'Developers',
      invited: '2023-01-20T12:00:00.000+00:00',
      joined: null,
      confirm: true,
      roles: ['member'],
    }),

    deleteMembership: jest.fn().mockResolvedValue({}),

    get: jest.fn().mockResolvedValue({
      $id: 'team1',
      $createdAt: '2023-01-10T06:38:00.000+00:00',
      $updatedAt: '2023-01-15T09:42:00.000+00:00',
      name: 'Developers',
      total: 3,
      prefs: {},
    }),
  };
});

export const Query = {
  search: jest.fn().mockReturnValue('search-query'),
  limit: jest.fn().mockReturnValue('limit-query'),
  offset: jest.fn().mockReturnValue('offset-query'),
};
