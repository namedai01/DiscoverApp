import 'package:cloud_firestore/cloud_firestore.dart';

import '../components/explore_list.dart';

searchedPeopleExploreList(datas, searchVal, followerDict) {
  List<DocumentSnapshot> listLocal = [];
  for (int i = 0; i < datas.length; ++i) {
    if (datas[i]['displayName']
            .substring(
              0,
              (searchVal.length < datas[i]['displayName'].length)
                  ? searchVal.length
                  : datas[i]['displayName'].length,
            )
            .toLowerCase() ==
        searchVal.toLowerCase()) {
      listLocal.add(datas[i]);
    }
  }
  print(listLocal);
  return (listLocal.length != 0)
      ? explorePeopleList(listLocal, followerDict)
      : noSearch();
}
