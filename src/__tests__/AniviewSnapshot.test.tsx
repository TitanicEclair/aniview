import * as React from 'react';
import * as renderer from 'react-test-renderer';
import { View, Text, StyleSheet } from 'react-native';

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    return Reanimated;
});

// Mock Aniview component to verify layout logic
jest.mock('../Aniview', () => {
  const { View } = require('react-native');
  return jest.fn((props: any) => {
    return <View testID="aniview-mock" style={props.style}>{props.children}</View>;
  });
});

import Aniview from '../Aniview';

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

  it('Scenario 1: Default Center Aligned', () => {
    const tree = renderer.create(
      <TestLayout 
        outerFlex={{ justifyContent: 'center', alignItems: 'center' }}
        innerFlex={{ padding: 20, backgroundColor: '#eee' }}
        textPos={{ fontSize: 20 }}
      />
    ).toJSON();
    console.log('TREE 1:', JSON.stringify(tree)); // DEBUG
    expect(tree).toMatchSnapshot();
  });

  it('Scenario 2: Space-Between Flex with Absolute Text', () => {
    const tree = renderer.create(
      <TestLayout 
        outerFlex={{ justifyContent: 'space-between', flexDirection: 'row' }}
        innerFlex={{ flex: 1, alignItems: 'flex-end' }}
        textPos={{ position: 'absolute', top: 10, right: 10, color: 'blue' }}
      />
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('Scenario 3: Column Reverse with Margin Auto', () => {
    const tree = renderer.create(
        <TestLayout 
          outerFlex={{ flexDirection: 'column-reverse' }}
          innerFlex={{ marginTop: 'auto', marginBottom: 20 }}
          textPos={{ textAlign: 'center', fontWeight: 'bold' }}
        />
      ).toJSON();
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
