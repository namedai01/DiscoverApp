import 'package:cloud_firestore/cloud_firestore.dart';

import '../components/explore_list.dart';

//This is a custom logic to perform Text Based Search from FireStore.
//a.k.a my biggest fear before implicating, Now its a piece of Cake.
searchedExploreList(datas, searchVal) {
  List<DocumentSnapshot> listLocal = [];
  for (int i = 0; i < datas.length; ++i) {
    if (datas[i]['venueName']
            .substring(
                0,
                (searchVal.length < datas[i]['venueName'].length)
                    ? searchVal.length
                    : datas[i]['venueName'].length)
            .toLowerCase() ==
        searchVal.toLowerCase()) {
      listLocal.add(datas[i]);
    }
  }
  return (listLocal.length != 0) ? exploreList(listLocal) : noSearch();
}

searchedPeopleExploreList(datas, searchVal, followerDict) {
  List<DocumentSnapshot> listLocal = [];
  for (int i = 0; i < datas.length; ++i) {
    if (datas[i]['displayName']
            .substring(
                0,
                (searchVal.length < datas[i]['displayName'].length)
                    ? searchVal.length
                    : datas[i]['displayName'].length)
            .toLowerCase() ==
        searchVal.toLowerCase()) {
      listLocal.add(datas[i]);
    }
  }
  print(listLocal);
  return (listLocal.length != 0) ? explorePeopleList(listLocal, followerDict) : noSearch();
}
