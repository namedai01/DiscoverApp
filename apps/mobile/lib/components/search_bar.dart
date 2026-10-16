import 'package:flutter/material.dart';

import '../logic/bloc.dart';

//This is SearchBar. (Named AppSearchBar to avoid clashing with Material's SearchBar.)
class AppSearchBar extends StatelessWidget {
  const AppSearchBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 50,
      alignment: Alignment.center,
      child: TextField(
        decoration: InputDecoration(
          border: InputBorder.none,
          prefixIcon: Icon(IconData(0xe804, fontFamily: 'TabIcons'), size: 20),
          hintText: 'Search',
        ),
        onChanged: (value) {
          bloc.feedSearchVal(value);
        },
      ),
      decoration: BoxDecoration(
        color: Color(0xffefefef),
        borderRadius: BorderRadius.circular(5),
      ),
    );
  }
}
