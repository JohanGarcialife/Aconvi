import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
export default function Communication() {
  return (
    <SafeAreaView style={s.safe}><View style={s.c}>
      <Text style={s.e}>��</Text>
      <Text style={s.t}>Comunicados</Text>
      <Text style={s.sub}>Avisos y comunicaciones de tu comunidad</Text>
    </View></SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#fff"},c:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:32},
  e:{fontSize:48,marginBottom:12},t:{fontSize:20,fontWeight:"800",color:"#0f172a",marginBottom:6},
  sub:{fontSize:14,color:"#64748b",textAlign:"center"}
});
