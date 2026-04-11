import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Explore from './explore';
import Home from './index';

const Tab = createBottomTabNavigator();

export default function TabsLayout() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Explore" component={Explore} />
    </Tab.Navigator>
  );
}
