'use strict';

const extractItems = (response, state) => {
	return response.getData().map((item, index) => ({
		...item,
		tags: item.tags || [],  // tags are not present on items in my publications
								// but most of the code expects tags key to be present
		[Symbol.for('meta')]: response.getMeta()[index] || {},
		[Symbol.for('attachmentUrl')]: item.itemType === 'attachment' &&
			`https://${state.config.apiConfig.apiAuthorityPart}/users/${state.config.userId}/items/${item.key}/file/view`
	}));
}

//@TODO: deprecate in favour of items-write.jsx chunkedAction()
const sequentialChunkedAcion = async (action, itemKeys, extraArgs = []) => {
	do {
		const itemKeysChunk = itemKeys.splice(0, 50);
		await action(itemKeysChunk, ...extraArgs);
	} while (itemKeys.length > 0);
}

export { extractItems, sequentialChunkedAcion };
