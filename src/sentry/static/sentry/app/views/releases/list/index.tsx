import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';
import {forceCheck} from 'react-lazyload';

import {t} from 'app/locale';
import space from 'app/styles/space';
import AsyncView from 'app/views/asyncView';
import {Organization, Release, GlobalSelection} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import SearchBar from 'app/components/searchBar';
import Pagination from 'app/components/pagination';
import PageHeading from 'app/components/pageHeading';
import withOrganization from 'app/utils/withOrganization';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import LoadingIndicator from 'app/components/loadingIndicator';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import {PageContent, PageHeader} from 'app/styles/organization';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {getRelativeSummary} from 'app/components/organizations/timeRangeSelector/utils';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {defined} from 'app/utils';

import ReleaseListSortOptions from './releaseListSortOptions';
import ReleaseLanding from './releaseLanding';
import IntroBanner from './introBanner';
import ReleaseCard from './releaseCard';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  selection: GlobalSelection;
};

type State = {
  releases: Release[];
  loadingHealth: boolean;
} & AsyncView['state'];

class ReleasesList extends AsyncView<Props, State> {
  shouldReload = true;

  getTitle() {
    return routeTitleGen(t('Releases'), this.props.organization.slug, false);
  }

  getEndpoints() {
    const {organization, location} = this.props;
    const {statsPeriod} = location.query;
    const sort = this.getSort();

    const query = {
      ...pick(location.query, [
        'project',
        'environment',
        'cursor',
        'query',
        'sort',
        'healthStatsPeriod',
        'healthStat',
      ]),
      summaryStatsPeriod: statsPeriod,
      per_page: 25,
      health: 1,
      flatten: sort === 'date' ? 0 : 1,
    };

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      ['releasesWithHealth', `/organizations/${organization.slug}/releases/`, {query}],
    ];

    // when sorting by date we fetch releases without health and then fetch health lazily
    if (sort === 'date') {
      endpoints.push([
        'releasesWithoutHealth',
        `/organizations/${organization.slug}/releases/`,
        {query: {...query, health: 0}},
      ]);
    }

    return endpoints;
  }

  onRequestSuccess({stateKey, data, jqXHR}) {
    const {remainingRequests} = this.state;

    // make sure there's no withHealth/withoutHealth race condition and set proper loading state
    if (stateKey === 'releasesWithHealth' || remainingRequests === 1) {
      this.setState({
        reloading: false,
        loading: false,
        loadingHealth: stateKey === 'releasesWithoutHealth',
        releases: data,
        releasesPageLinks: jqXHR?.getResponseHeader('Link'),
      });
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    super.componentDidUpdate(prevProps, prevState);

    if (prevState.releases !== this.state.releases) {
      /**
       * Manually trigger checking for elements in viewport.
       * Helpful when LazyLoad components enter the viewport without resize or scroll events,
       * https://github.com/twobin/react-lazyload#forcecheck
       *
       * HealthStatsCharts are being rendered only when they are scrolled into viewport.
       * This is how we re-check them without scrolling once releases change as this view
       * uses shouldReload=true and there is no reloading happening.
       */
      forceCheck();
    }
  }

  getQuery() {
    const {query} = this.props.location.query;

    return typeof query === 'string' ? query : undefined;
  }

  getSort() {
    const {sort} = this.props.location.query;

    return typeof sort === 'string' ? sort : 'date';
  }

  handleSearch = (query: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, query},
    });
  };

  handleSort = (sort: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, sort},
    });
  };

  shouldShowLoadingIndicator() {
    const {loading, releases, reloading} = this.state;

    return (loading && !reloading) || (loading && !releases?.length);
  }

  renderLoading() {
    return this.renderBody();
  }

  renderEmptyMessage() {
    const {location, organization} = this.props;
    const {statsPeriod} = location.query;
    const searchQuery = this.getQuery();
    const activeSort = this.getSort();

    if (searchQuery && searchQuery.length) {
      return (
        <EmptyStateWarning small>{`${t(
          'There are no releases that match'
        )}: '${searchQuery}'.`}</EmptyStateWarning>
      );
    }

    if (activeSort === 'users_24h') {
      return (
        <EmptyStateWarning small>
          {t('There are no releases with active user data (users in the last 24 hours).')}
        </EmptyStateWarning>
      );
    }

    if (activeSort !== 'date') {
      const relativePeriod = getRelativeSummary(
        statsPeriod || DEFAULT_STATS_PERIOD
      ).toLowerCase();

      return (
        <EmptyStateWarning small>
          {`${t('There are no releases with data in the')} ${relativePeriod}.`}
        </EmptyStateWarning>
      );
    }

    if (defined(statsPeriod) && statsPeriod !== '14d') {
      return <EmptyStateWarning small>{t('There are no releases.')}</EmptyStateWarning>;
    }

    return <ReleaseLanding organization={organization} />;
  }

  renderInnerBody() {
    const {location, selection, organization} = this.props;
    const {reloading, loadingHealth} = this.state;

    if (this.shouldShowLoadingIndicator()) {
      return <LoadingIndicator />;
    }

    const releases = [
      {
        dateReleased: null,
        newGroups: 1,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-11-06T08:37:14Z',
        lastEvent: '2020-11-06T08:37:14Z',
        version: 'Premiere Pro@14.7.0+8',
        firstEvent: '2020-11-06T08:37:14Z',
        lastCommit: null,
        shortVersion: 'Premiere Pro@14.7.0+8',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.7.0+8',
            major: 14,
            buildCode: '8',
            components: 3,
            minor: 7,
            patch: 0,
          },
          description: '14.7.0 (8)',
          package: 'Premiere Pro',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 1,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 1,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-11-06T06:02:26Z',
        lastEvent: '2020-11-06T06:47:02Z',
        version: 'Premiere Pro (Beta)@14.7.0+8',
        firstEvent: '2020-11-06T06:02:26Z',
        lastCommit: null,
        shortVersion: 'Premiere Pro (Beta)@14.7.0+8',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.7.0+8',
            major: 14,
            buildCode: '8',
            components: 3,
            minor: 7,
            patch: 0,
          },
          description: '14.7.0 (8)',
          package: 'Premiere Pro (Beta)',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 1,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 3,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-11-05T23:12:21.451819Z',
        lastEvent: '2020-11-06T09:00:52Z',
        version: 'Premiere Pro@14.6.0+49',
        firstEvent: '2020-11-05T23:12:21Z',
        lastCommit: null,
        shortVersion: 'Premiere Pro@14.6.0+49',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.6.0+49',
            major: 14,
            buildCode: '49',
            components: 3,
            minor: 6,
            patch: 0,
          },
          description: '14.6.0 (49)',
          package: 'Premiere Pro',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 3,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 6,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-11-05T05:56:18Z',
        lastEvent: '2020-11-06T03:56:14Z',
        version: 'Premiere Pro (Beta)@14.7.0+7',
        firstEvent: '2020-11-05T05:56:18Z',
        lastCommit: null,
        shortVersion: 'Premiere Pro (Beta)@14.7.0+7',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.7.0+7',
            major: 14,
            buildCode: '7',
            components: 3,
            minor: 7,
            patch: 0,
          },
          description: '14.7.0 (7)',
          package: 'Premiere Pro (Beta)',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 6,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 6,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-11-04T06:45:26Z',
        lastEvent: '2020-11-05T21:04:39Z',
        version: 'Premiere Pro (Beta)@14.7.0+6',
        firstEvent: '2020-11-04T06:45:26Z',
        lastCommit: null,
        shortVersion: 'Premiere Pro (Beta)@14.7.0+6',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.7.0+6',
            major: 14,
            buildCode: '6',
            components: 3,
            minor: 7,
            patch: 0,
          },
          description: '14.7.0 (6)',
          package: 'Premiere Pro (Beta)',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 6,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 0,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-11-04T06:00:00Z',
        lastEvent: null,
        version: 'Premiere Pro@14.7.0+6',
        firstEvent: null,
        lastCommit: null,
        shortVersion: 'Premiere Pro@14.7.0+6',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.7.0+6',
            major: 14,
            buildCode: '6',
            components: 3,
            minor: 7,
            patch: 0,
          },
          description: '14.7.0 (6)',
          package: 'Premiere Pro',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 0,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 2,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-11-03T22:00:00Z',
        lastEvent: '2020-11-05T08:19:31Z',
        version: 'Premiere Pro@14.6.0+48',
        firstEvent: '2020-11-04T11:16:31Z',
        lastCommit: null,
        shortVersion: 'Premiere Pro@14.6.0+48',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.6.0+48',
            major: 14,
            buildCode: '48',
            components: 3,
            minor: 6,
            patch: 0,
          },
          description: '14.6.0 (48)',
          package: 'Premiere Pro',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 2,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 0,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-11-03T10:00:00Z',
        lastEvent: null,
        version: 'Premiere Pro@14.7.0+1',
        firstEvent: null,
        lastCommit: null,
        shortVersion: 'Premiere Pro@14.7.0+1',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.7.0+1',
            major: 14,
            buildCode: '1',
            components: 3,
            minor: 7,
            patch: 0,
          },
          description: '14.7.0 (1)',
          package: 'Premiere Pro',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 0,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 1,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-11-03T08:00:21Z',
        lastEvent: '2020-11-04T19:16:06Z',
        version: 'Premiere Pro (Beta)@14.7.0+5',
        firstEvent: '2020-11-03T08:00:21Z',
        lastCommit: null,
        shortVersion: 'Premiere Pro (Beta)@14.7.0+5',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.7.0+5',
            major: 14,
            buildCode: '5',
            components: 3,
            minor: 7,
            patch: 0,
          },
          description: '14.7.0 (5)',
          package: 'Premiere Pro (Beta)',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 1,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 0,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-11-03T00:00:00Z',
        lastEvent: null,
        version: '14.1.0',
        firstEvent: null,
        lastCommit: null,
        shortVersion: '14.1.0',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {raw: '14.1.0'},
          description: '14.1.0',
          package: null,
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 0,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 0,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-11-02T22:00:00Z',
        lastEvent: null,
        version: 'Premiere Pro@14.7.0+4',
        firstEvent: null,
        lastCommit: null,
        shortVersion: 'Premiere Pro@14.7.0+4',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.7.0+4',
            major: 14,
            buildCode: '4',
            components: 3,
            minor: 7,
            patch: 0,
          },
          description: '14.7.0 (4)',
          package: 'Premiere Pro',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 0,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 2,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-11-02T08:40:16Z',
        lastEvent: '2020-11-03T02:09:55Z',
        version: 'Premiere Pro (Beta)@14.7.0+3',
        firstEvent: '2020-11-02T08:40:16Z',
        lastCommit: null,
        shortVersion: 'Premiere Pro (Beta)@14.7.0+3',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.7.0+3',
            major: 14,
            buildCode: '3',
            components: 3,
            minor: 7,
            patch: 0,
          },
          description: '14.7.0 (3)',
          package: 'Premiere Pro (Beta)',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 2,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 2,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-11-02T06:47:05Z',
        lastEvent: '2020-11-02T08:58:50Z',
        version: 'Premiere Pro (Beta)@14.7.0+4',
        firstEvent: '2020-11-02T06:47:05Z',
        lastCommit: null,
        shortVersion: 'Premiere Pro (Beta)@14.7.0+4',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.7.0+4',
            major: 14,
            buildCode: '4',
            components: 3,
            minor: 7,
            patch: 0,
          },
          description: '14.7.0 (4)',
          package: 'Premiere Pro (Beta)',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 2,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 0,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-11-01T12:00:00Z',
        lastEvent: null,
        version: 'Premiere Pro@14.7.0+3',
        firstEvent: null,
        lastCommit: null,
        shortVersion: 'Premiere Pro@14.7.0+3',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.7.0+3',
            major: 14,
            buildCode: '3',
            components: 3,
            minor: 7,
            patch: 0,
          },
          description: '14.7.0 (3)',
          package: 'Premiere Pro',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 0,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 0,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-10-31T11:00:00Z',
        lastEvent: null,
        version: 'Premiere Pro (Beta)@14.7.0+2',
        firstEvent: null,
        lastCommit: null,
        shortVersion: 'Premiere Pro (Beta)@14.7.0+2',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.7.0+2',
            major: 14,
            buildCode: '2',
            components: 3,
            minor: 7,
            patch: 0,
          },
          description: '14.7.0 (2)',
          package: 'Premiere Pro (Beta)',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 0,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 3,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-10-30T07:40:32Z',
        lastEvent: '2020-11-03T02:48:55Z',
        version: 'Premiere Pro@14.6.0+47',
        firstEvent: '2020-10-30T07:40:32Z',
        lastCommit: null,
        shortVersion: 'Premiere Pro@14.6.0+47',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.6.0+47',
            major: 14,
            buildCode: '47',
            components: 3,
            minor: 6,
            patch: 0,
          },
          description: '14.6.0 (47)',
          package: 'Premiere Pro',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 3,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 0,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-10-29T17:00:00Z',
        lastEvent: '2020-11-06T06:39:52Z',
        version: 'Premiere Pro (Beta)@14.7.0+1',
        firstEvent: '2020-11-04T11:18:31Z',
        lastCommit: null,
        shortVersion: 'Premiere Pro (Beta)@14.7.0+1',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.7.0+1',
            major: 14,
            buildCode: '1',
            components: 3,
            minor: 7,
            patch: 0,
          },
          description: '14.7.0 (1)',
          package: 'Premiere Pro (Beta)',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 0,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 0,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-10-29T06:00:00Z',
        lastEvent: null,
        version: 'Premiere Pro@14.6.0+46',
        firstEvent: null,
        lastCommit: null,
        shortVersion: 'Premiere Pro@14.6.0+46',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.6.0+46',
            major: 14,
            buildCode: '46',
            components: 3,
            minor: 6,
            patch: 0,
          },
          description: '14.6.0 (46)',
          package: 'Premiere Pro',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 0,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 33,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-10-29T05:57:12Z',
        lastEvent: '2020-11-06T10:04:16Z',
        version: 'Premiere Pro (Beta)@14.6.0+46',
        firstEvent: '2020-10-29T05:57:12Z',
        lastCommit: null,
        shortVersion: 'Premiere Pro (Beta)@14.6.0+46',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.6.0+46',
            major: 14,
            buildCode: '46',
            components: 3,
            minor: 6,
            patch: 0,
          },
          description: '14.6.0 (46)',
          package: 'Premiere Pro (Beta)',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 33,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 0,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-10-28T23:00:00Z',
        lastEvent: null,
        version: '14.0.3',
        firstEvent: null,
        lastCommit: null,
        shortVersion: '14.0.3',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {raw: '14.0.3'},
          description: '14.0.3',
          package: null,
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 0,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 0,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-10-28T14:00:00Z',
        lastEvent: null,
        version: 'Premiere Pro@14.3.0+38',
        firstEvent: null,
        lastCommit: null,
        shortVersion: 'Premiere Pro@14.3.0+38',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.3.0+38',
            major: 14,
            buildCode: '38',
            components: 3,
            minor: 3,
            patch: 0,
          },
          description: '14.3.0 (38)',
          package: 'Premiere Pro',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 0,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 0,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-10-28T12:00:00Z',
        lastEvent: '2020-11-05T00:46:17Z',
        version: 'Premiere Pro@14.6.0+45',
        firstEvent: '2020-11-05T00:46:17Z',
        lastCommit: null,
        shortVersion: 'Premiere Pro@14.6.0+45',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.6.0+45',
            major: 14,
            buildCode: '45',
            components: 3,
            minor: 6,
            patch: 0,
          },
          description: '14.6.0 (45)',
          package: 'Premiere Pro',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 0,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 1,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-10-28T10:00:00Z',
        lastEvent: '2020-11-05T12:02:10Z',
        version: 'Premiere Pro@1.5.34+48',
        firstEvent: '2020-11-05T12:02:10Z',
        lastCommit: null,
        shortVersion: 'Premiere Pro@1.5.34+48',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '1.5.34+48',
            major: 1,
            buildCode: '48',
            components: 3,
            minor: 5,
            patch: 34,
          },
          description: '1.5.34 (48)',
          package: 'Premiere Pro',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 1,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 3,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-10-28T06:16:35Z',
        lastEvent: '2020-11-01T07:23:10Z',
        version: 'Premiere Pro (Beta)@14.6.0+45',
        firstEvent: '2020-10-28T06:16:35Z',
        lastCommit: null,
        shortVersion: 'Premiere Pro (Beta)@14.6.0+45',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.6.0+45',
            major: 14,
            buildCode: '45',
            components: 3,
            minor: 6,
            patch: 0,
          },
          description: '14.6.0 (45)',
          package: 'Premiere Pro (Beta)',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 3,
            id: 5227327,
          },
        ],
      },
      {
        dateReleased: null,
        newGroups: 6,
        commitCount: 0,
        url: null,
        data: {},
        lastDeploy: null,
        deployCount: 0,
        dateCreated: '2020-10-28T05:02:43Z',
        lastEvent: '2020-10-31T15:53:57Z',
        version: 'Premiere Pro (Beta)@14.6.0+44',
        firstEvent: '2020-10-28T05:02:43Z',
        lastCommit: null,
        shortVersion: 'Premiere Pro (Beta)@14.6.0+44',
        authors: [],
        owner: null,
        versionInfo: {
          buildHash: null,
          version: {
            pre: null,
            raw: '14.6.0+44',
            major: 14,
            buildCode: '44',
            components: 3,
            minor: 6,
            patch: 0,
          },
          description: '14.6.0 (44)',
          package: 'Premiere Pro (Beta)',
        },
        ref: null,
        projects: [
          {
            name: 'dva-premiere',
            platform: 'native',
            slug: 'dva-premierepro',
            platforms: ['native'],
            hasHealthData: true,
            newGroups: 6,
            id: 5227327,
          },
        ],
      },
    ];

    if (!releases?.length) {
      return this.renderEmptyMessage();
    }

    return releases.map(release => (
      <ReleaseCard
        release={release}
        orgSlug={organization.slug}
        location={location}
        selection={selection}
        reloading={reloading}
        key={`${release.version}-${release.projects[0].slug}`}
        showHealthPlaceholders={loadingHealth}
      />
    ));
  }

  renderBody() {
    const {organization} = this.props;
    const {releasesPageLinks} = this.state;

    return (
      <GlobalSelectionHeader
        showAbsolute={false}
        timeRangeHint={t(
          'Changing this date range will recalculate the release metrics.'
        )}
      >
        <PageContent>
          <LightWeightNoProjectMessage organization={organization}>
            <StyledPageHeader>
              <PageHeading>{t('Releases')}</PageHeading>
              <SortAndFilterWrapper>
                <ReleaseListSortOptions
                  selected={this.getSort()}
                  onSelect={this.handleSort}
                />
                <SearchBar
                  placeholder={t('Search')}
                  onSearch={this.handleSearch}
                  query={this.getQuery()}
                />
              </SortAndFilterWrapper>
            </StyledPageHeader>

            <IntroBanner />

            {this.renderInnerBody()}

            <Pagination pageLinks={releasesPageLinks} />
          </LightWeightNoProjectMessage>
        </PageContent>
      </GlobalSelectionHeader>
    );
  }
}

const StyledPageHeader = styled(PageHeader)`
  flex-wrap: wrap;
  margin-bottom: 0;
  ${PageHeading} {
    margin-bottom: ${space(2)};
  }
`;
const SortAndFilterWrapper = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
  grid-gap: ${space(2)};
  margin-bottom: ${space(2)};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    width: 100%;
    grid-template-columns: none;
    grid-template-rows: 1fr 1fr;
    margin-bottom: ${space(4)};
  }
`;

export default withOrganization(withGlobalSelection(ReleasesList));
export {ReleasesList};
