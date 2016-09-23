namespace Manifold {
    
    export class Bootstrapper {
        
        private _options: Manifold.IManifoldOptions;
        
        constructor(options: Manifold.IManifoldOptions){
            this._options = options;
        }

        public bootstrap(): Promise<Manifold.IHelper> {

            var that = this;

            return new Promise<Manifold.IHelper>((resolve, reject) => {

                var msie = that._msieversion();

                if (msie === 9 || !this._options.isCORSEnabled){
                    var settings: JQueryAjaxSettings = <JQueryAjaxSettings>{
                        url: this._options.iiifResourceUri,
                        type: 'GET',
                        dataType: 'jsonp',
                        jsonp: 'callback',
                        jsonpCallback: 'manifestCallback'
                    };
                    $.ajax(settings);
                    window.manifestCallback = (json: any) => {
                        this._loaded(this, JSON.stringify(json), resolve, reject);
                    };
                } else {
                    var settings: JQueryAjaxSettings = <JQueryAjaxSettings>{
                        url: this._options.iiifResourceUri,
                        type: 'GET',
                        dataType: 'json',
                        xhrFields: { withCredentials: true },
                        success: (json) => {
                            this._loaded(this, JSON.stringify(json), resolve, reject);
                        }
                    };
                    $.ajax(settings);
                }

            });
        }

        private _loaded(bootstrapper: Bootstrapper, json: string, resolve: (helper: IHelper) => void, reject: (error:any) => void): void {
            
            var iiifResource: Manifesto.IIIIFResource = manifesto.create(json, <Manifesto.IManifestoOptions>{
                locale: bootstrapper._options.locale
            });
            
            // only set the root IIIFResource on the first load
            if (!bootstrapper._options.iiifResource){
                bootstrapper._options.iiifResource = iiifResource;
            }

            if (iiifResource.getIIIFResourceType().toString() === manifesto.IIIFResourceType.collection().toString()){
                // if it's a collection and has child collections, get the collection by index
                var collections: Manifesto.ICollection[] = (<Manifesto.ICollection>iiifResource).getCollections();

                if (collections && collections.length){

                    (<Manifesto.ICollection>iiifResource).getCollectionByIndex(bootstrapper._options.collectionIndex).then((collection: Manifesto.ICollection) => {

                        if (!collection){
                            reject('Collection index not found');
                        }

                        // Special case: we're trying to load the first manifest of the
                        // collection, but the collection has no manifests but does have
                        // subcollections. Thus, we should dive in until we find something
                        // we can display!
                        if (collection.getTotalManifests() === 0 && bootstrapper._options.manifestIndex === 0 && collection.getTotalCollections() > 0) {
                            bootstrapper._options.collectionIndex = 0;
                            bootstrapper._options.iiifResourceUri = collection.id;
                            bootstrapper.bootstrap();
                        }

                        collection.getManifestByIndex(bootstrapper._options.manifestIndex).then((manifest: Manifesto.IManifest) => {
                            bootstrapper._options.manifest = manifest;
                            var helper: Manifold.Helper = new Helper(bootstrapper._options);
                            resolve(helper);
                        });
                    });
                } else {
                    (<Manifesto.ICollection>iiifResource).getManifestByIndex(bootstrapper._options.manifestIndex).then((manifest: Manifesto.IManifest) => {
                        bootstrapper._options.manifest = manifest;
                        var helper: Manifold.Helper = new Helper(bootstrapper._options);
                        resolve(helper);
                    });
                }
            } else {
                bootstrapper._options.manifest = <Manifesto.IManifest>iiifResource;
                var helper: Manifold.Helper = new Helper(bootstrapper._options);
                resolve(helper);
            }
        }

        private _msieversion(): number{
            var ua = window.navigator.userAgent;
            var msie = ua.indexOf("MSIE ");

            if (msie > 0){  // If Internet Explorer, return version number
                return parseInt (ua.substring (msie+5, ua.indexOf (".", msie)));
            } else {        // If another browser, return 0
                return 0;
            }
        }

    }
    
}