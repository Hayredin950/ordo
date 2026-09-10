/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CommunityView } from './components/challenges/CommunityView';
import { INITIAL_CHALLENGES } from './mockData';

export default function App() {
  return <CommunityView initialChallenges={INITIAL_CHALLENGES} />;
}

