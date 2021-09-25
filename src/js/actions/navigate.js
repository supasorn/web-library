import { makePath } from '../common/navigation';
import { getItemKeysPath } from '../common/state';
import { push } from 'connected-react-router';
import { clamp, get } from '../utils';
import { fetchChildItems, getAttachmentUrl } from '.';

const navigate = (path, isAbsolute = false) => {
	return async (dispatch, getState) => {
		const { config, current } = getState();
		if(isAbsolute) {
			const configuredPath = makePath(config, path);
			dispatch(push(configuredPath));
		} else {
			const updatedPath = {
				attachmentKey: current.attachmentKey,
				collection: current.collectionKey,
				items: current.itemKeys,
				library: current.libraryKey,
				noteKey: current.noteKey,
				publications: current.isMyPublications,
				qmode: current.qmode,
				search: current.search,
				tags: current.tags,
				trash: current.isTrash,
				view: current.view,
				...path
			};
			const configuredPath = makePath(config, updatedPath);
			dispatch(push(configuredPath));
		}
	}
};

const selectItemsKeyboard = (direction, magnitude, isMultiSelect) => {
	return async (dispatch, getState) => {
		const state = getState();
		const { collectionKey, libraryKey, itemKeys: selectedItemKeys, itemsSource } = state.current;
		const path = [...getItemKeysPath({ itemsSource, libraryKey, collectionKey }), 'keys'];

		const keys = get(state, path, []);

		const vector = direction * magnitude;
		const lastItemKey = selectedItemKeys[selectedItemKeys.length - 1];
		const index = keys.findIndex(key => key && key === lastItemKey);

		var nextKeys;
		var cursorIndex;

		if(direction === -1 && magnitude === 1 && index + vector < 0 && !isMultiSelect) {
			nextKeys = [];
			cursorIndex = -1;
		} else {
			const nextIndex = clamp(index + vector, 0, keys.length -1);
			cursorIndex = nextIndex;
			if(isMultiSelect) {
				let counter = 1;
				let alreadySelectedCounter = 0;
				let newKeys = [];

				while(index + counter * direction !== nextIndex + direction) {
					const nextKey = keys[index + counter * direction];
					newKeys.push(nextKey);
					if(selectedItemKeys.includes(nextKey)) {
						alreadySelectedCounter++;
					}
					counter++;
				}

				const shouldUnselect = alreadySelectedCounter === magnitude;

				if(shouldUnselect) {
					nextKeys = selectedItemKeys.filter(k => k === keys[nextIndex] || (!newKeys.includes(k) && k !== keys[index]));
				} else {
					var invertedDirection = direction * -1;
					var consecutiveSelectedItemKeys = [];
					var reverseCounter = 0;
					var boundry = invertedDirection > 0 ? keys.length : -1;

					while(index + reverseCounter * invertedDirection !== boundry) {
						const nextKey = keys[index + reverseCounter * invertedDirection];
						if(selectedItemKeys.includes(nextKey)) {
							consecutiveSelectedItemKeys.push(nextKey);
							reverseCounter++;
						} else {
							break;
						}
					}
					consecutiveSelectedItemKeys.reverse();
					nextKeys = [...consecutiveSelectedItemKeys, ...newKeys];
				}

				if(nextKeys.length === 0) {
					nextKeys = [keys[nextIndex]];
				}
			} else {
				nextKeys = [keys[nextIndex]];
				cursorIndex = nextIndex;
			}
		}

		if(typeof nextKeys === 'undefined') {
			return cursorIndex;
		}
    let targetItemKey = nextKeys[0];
    let itemsByParent = get(state, ['libraries', state.current.libraryKey, 'itemsByParent', targetItemKey], null);
    if(!itemsByParent) {
      await dispatch(fetchChildItems(targetItemKey, { start: 0, limit: 100 }));
      itemsByParent = get(getState(), ['libraries', state.current.libraryKey, 'itemsByParent', targetItemKey], null);
    }
    if(itemsByParent && itemsByParent.keys.length > 0) {
      for (let i = 0; i < itemsByParent.keys.length; i++) {
        const firstAttachmentKey = itemsByParent.keys[i];
        const item = get(getState(), ['libraries', state.current.libraryKey, 'items', firstAttachmentKey], null);
        if (item && item.contentType == "application/pdf") {
          console.log("Found pdf" + item.key);
          document.getElementById("pdf_preview").innerHTML = "Loading Thumbnails";

          $("#pdf_preview").html('<iframe width="100%" height="1200px" style="border: 0;" src="http://localhost:5000/web/viewer.html?file=http://localhost:5000/paper/' + item.key + '"></iframe>');
          //const xhttp = new XMLHttpRequest();
          //xhttp.onload = function() {
            //$("#pdf_preview").html(this.responseText);
          //}
          //xhttp.open("GET", "http://localhost:8000/web/viewer.html?file=http://localhost:5000/paper/" + item.key, true);
          //xhttp.open("GET", "http://localhost:5000/thumb/" + item.key, true);
          //xhttp.send();
          break;
        }
      }
    }

		dispatch(navigate({ items: nextKeys, noteKey: null, attachmentKey: null }));
		return cursorIndex;
	}
}

const selectFirstItem = (onlyIfNoneSelected = false) => {
	return async (dispatch, getState) => {
		const state = getState();
		const { collectionKey, libraryKey, itemKeys: selectedItemKeys, itemsSource } = state.current;
		const path = [...getItemKeysPath({ itemsSource, libraryKey, collectionKey }), 'keys'];

		if(onlyIfNoneSelected && selectedItemKeys.length > 0) {
			return null;
		}

		const keys = get(state, path, []);
		if(keys.length > 0) {
			dispatch(navigate({ items: [keys[0]], noteKey: null, attachmentKey: null }));
			return 0;
		}
		return null;
	}
}

const selectLastItem = () => {
	return async (dispatch, getState) => {
		const state = getState();
		const { collectionKey, libraryKey, itemsSource } = state.current;
		const path = [...getItemKeysPath({ itemsSource, libraryKey, collectionKey }), 'keys'];

		const keys = get(state, path, []);
		if(keys.length > 0) {
			dispatch(navigate({ items: [keys[keys.length - 1]], noteKey: null, attachmentKey: null }));
			return keys.length - 1;
		}
		return null;
	}
}


const selectItemsMouse = (targetItemKey, isShiftModifer, isCtrlModifer) => {
	return async (dispatch, getState) => {
		const state = getState();
		const { collectionKey, libraryKey, itemKeys: selectedItemKeys, itemsSource } = state.current;
		const path = [...getItemKeysPath({ itemsSource, libraryKey, collectionKey }), 'keys'];
		const keys = get(state, path, []);
		var newKeys;

		if(isShiftModifer) {
			let startIndex = selectedItemKeys.length ? keys.findIndex(key => key && key === selectedItemKeys[0]) : 0;
			let endIndex = keys.findIndex(key => key && key === targetItemKey);
			let isFlipped = false;
			if(startIndex > endIndex) {
				[startIndex, endIndex] = [endIndex, startIndex];
				isFlipped = true;
			}

			endIndex++;
			newKeys = keys.slice(startIndex, endIndex);
			if(isFlipped) {
				newKeys.reverse();
			}
		} else if(false && isCtrlModifer) { // use ctrl to open thumbnail in new tab instead
			if(selectedItemKeys.includes(targetItemKey)) {
				newKeys = selectedItemKeys.filter(key => key !== targetItemKey);
			} else {
				newKeys = [...(new Set([...selectedItemKeys, targetItemKey]))];
			}
		} else {
			newKeys = [targetItemKey];

      //var element = document.getElementById("pdf_preview");
      //element.innerHTML = "<img width='50px' src='http://localhost:5000/papers/2006.11239/paper_s00.jpg'/>";

      let itemsByParent = get(state, ['libraries', state.current.libraryKey, 'itemsByParent', targetItemKey], null);
      if(!itemsByParent) {
        await dispatch(fetchChildItems(targetItemKey, { start: 0, limit: 100 }));
        itemsByParent = get(getState(), ['libraries', state.current.libraryKey, 'itemsByParent', targetItemKey], null);
      }
      if(itemsByParent && itemsByParent.keys.length > 0) {
        for (let i = 0; i < itemsByParent.keys.length; i++) {
          const firstAttachmentKey = itemsByParent.keys[i];
          const item = get(getState(), ['libraries', state.current.libraryKey, 'items', firstAttachmentKey], null);
          if (item && item.contentType == "application/pdf") {
						if (isCtrlModifer) {
							//window.open("http://localhost:5000/thumbpdf/" + item.key + "?script");
							window.open("http://localhost:5000/web/viewer.html?file=http://localhost:5000/paper/" + item.key);
						} else {
							console.log("Found pdf" + item.key);
							document.getElementById("pdf_preview").innerHTML = "Loading Thumbnails";

              $("#pdf_preview").html('<iframe width="100%" height="1200px" style="border: 0;" src="http://localhost:5000/web/viewer.html?file=http://localhost:5000/paper/' + item.key + '"></iframe>');
							//const xhttp = new XMLHttpRequest();
							//xhttp.onload = function() {
								//$("#pdf_preview").html(this.responseText);
							//}
							
							//xhttp.open("GET", "http://localhost:5000/thumb/" + item.key, true);
							//xhttp.open("GET", "http://localhost:8000/web/viewer.html?file=http://localhost:5000/paper/" + item.key, true);
							//xhttp.send();
						}
						break;
          }
        }
      }
		}
		dispatch(navigate({ items: newKeys, noteKey: null, attachmentKey: null }));
	}
}

const navigateExitSearch = () => {
	return async (dispatch, getState) => {
		const state = getState();
		const { collectionKey, isMyPublications, isTrash, libraryKey, searchState, view, itemKey, tags } =
		state.current;

		dispatch(navigate({
			library: view === 'libraries' ? null : libraryKey,
			collection: collectionKey,
			items: searchState.triggerView === 'item-details' && searchState.triggerItem ? searchState.triggerItem : itemKey,
			trash: isTrash,
			tags: tags,
			attachmentKey: searchState.attachmentKey || null,
			noteKey: searchState.noteKey || null,
			publications: isMyPublications,
			view: searchState.triggerView ?
				searchState.triggerView === 'item-details' ?
					searchState.triggerItem ? 'item-details' : 'item-list'
					: searchState.triggerView
				: view
		}, true));
	}
}


export { navigate, navigateExitSearch, selectFirstItem, selectItemsKeyboard, selectItemsMouse, selectLastItem };
