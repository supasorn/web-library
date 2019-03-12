'use strict';

const { CONFIGURE_API, SORT_ITEMS } = require('../constants/actions.js');

const defaultState = {
	apiKey: null,
	apiConfig: {},
	userId: null,
	sortBy: 'title',
	sortDirection: 'asc'
};

const config = (state = defaultState, action) => {
	switch(action.type) {
		case CONFIGURE_API:
			return {
				...state,
				apiConfig: action.apiConfig,
				apiKey: action.apiKey,
				stylesSourceUrl: action.stylesSourceUrl,
				userId: action.userId,
			};
		case SORT_ITEMS:
			return {
				...state,
				sortBy: action.sortBy,
				sortDirection: action.sortDirection
			};
		default:
			return state;
	}
};

module.exports = config
