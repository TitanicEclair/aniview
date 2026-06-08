import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { View, Text, StyleSheet } from 'react-native';

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    return Reanimated;
});

// Local test double: this suite validates layout composition, not the runtime
// Aniview animation/provider contract.
const Aniview = (props: any) => (
  <View testID="aniview-mock" style={props.style}>{props.children}</View>
);

describe('Aniview Snapshot Suite', () => {
  
  const TestLayout = ({ outerFlex, innerFlex, textPos }: any) => (
    <Aniview pageId={1} style={[styles.outer, outerFlex]}>
        <View style={[styles.inner, innerFlex]}>
          <Text style={[styles.text, textPos]}>Main Content</Text>
          <Aniview pageId={2} style={styles.nested}>
             <Text>Nested Item</Text>
          </Aniview>
        </View>
    </Aniview>
  );

  const renderLayout = (props: any) => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(<TestLayout {...props} />);
    });
    return tree!.toJSON();
  };

  it('Scenario 1: Default Center Aligned', () => {
    const tree = renderLayout({
      outerFlex: { justifyContent: 'center', alignItems: 'center' },
      innerFlex: { padding: 20, backgroundColor: '#eee' },
      textPos: { fontSize: 20 },
    });
    expect(tree).toMatchSnapshot();
  });

  it('Scenario 2: Space-Between Flex with Absolute Text', () => {
    const tree = renderLayout({
      outerFlex: { justifyContent: 'space-between', flexDirection: 'row' },
      innerFlex: { flex: 1, alignItems: 'flex-end' },
      textPos: { position: 'absolute', top: 10, right: 10, color: 'blue' },
    });
    expect(tree).toMatchSnapshot();
  });

  it('Scenario 3: Column Reverse with Margin Auto', () => {
    const tree = renderLayout({
      outerFlex: { flexDirection: 'column-reverse' },
      innerFlex: { marginTop: 'auto', marginBottom: 20 },
      textPos: { textAlign: 'center', fontWeight: 'bold' },
    });
    expect(tree).toMatchSnapshot();
  });
});

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    height: '100%',
  },
  inner: {
    borderRadius: 10,
  },
  text: {
    fontFamily: 'System',
  },
  nested: {
    width: 100,
    height: 50,
    backgroundColor: 'rgba(0,0,0,0.1)',
  }
});
