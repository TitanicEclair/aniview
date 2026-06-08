import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Page-world animation',
    description: (
      <>
        Define a 2D page layout and let Aniview drive component position,
        opacity, color, and transforms from the current camera page.
      </>
    ),
  },
  {
    title: 'Shared event frames',
    description: (
      <>
        Use Reanimated shared values such as scroll, zoom, and progress in the
        same frame model as page transitions.
      </>
    ),
  },
  {
    title: 'Built for coordination',
    description: (
      <>
        Coordinate page swipes with nested gestures, persistent animated
        surfaces, and precomputed interpolation lanes.
      </>
    ),
  },
];

function Feature({title, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className={styles.featureCard}>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
